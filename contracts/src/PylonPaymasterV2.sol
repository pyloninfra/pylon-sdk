// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@account-abstraction/interfaces/IPaymaster.sol";
import "@account-abstraction/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract PylonPaymasterV2 is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuard,
    IPaymaster
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct Policy {
        uint8 version;
        address sender;
        uint48 validUntil;
        uint48 validAfter;
        uint256 maxGas;
        bytes32 salt;
    }

    struct SpentInfo {
        uint64 day;
        uint256 amount;
    }

    bytes32 public constant POLICY_TYPEHASH = keccak256(
        "PolicyV2(bytes32 preUserOpHash,uint8 version,address sender,uint48 validUntil,uint48 validAfter,uint256 maxGas,bytes32 salt)"
    );

    IEntryPoint public entryPoint;
    address public policySigner;
    uint256 public maxGasPerOp;

    mapping(address => bool) public allowlist;
    mapping(bytes32 => bool) public usedSalts;
    mapping(address => SpentInfo) public dailySpent;
    mapping(address => uint256) public dailyLimit;
    uint256 public globalDailyLimit;

    mapping(address => bool) public isAdmin;
    address[] private _admins;

    event Sponsored(address indexed sender, bytes32 indexed salt, uint256 totalGas, uint256 maxFeePerGas);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event SweptNative(address indexed to, uint256 amount);
    event DailyLimitUpdated(address indexed addr, uint256 newLimit);
    event GlobalDailyLimitUpdated(uint256 newLimit);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event AllowlistUpdated(address indexed addr, bool allowed);
    event MaxGasPerOpUpdated(uint256 oldMaxGas, uint256 newMaxGas);

    error NotEntryPoint();
    error NotAllowed();
    error InvalidSignature();
    error InvalidPolicyVersion();
    error SaltUsed();
    error GasTooHigh();
    error DailyLimitExceeded();
    error NotAdmin();
    error ZeroMaxFeePerGas();

    constructor() {
        _disableInitializers();
    }

    function initialize(IEntryPoint _ep, address _owner, address _signer) public initializer {
        require(address(_ep) != address(0), "EP_ZERO");
        require(_owner != address(0), "OWNER_ZERO");
        require(_signer != address(0), "SIGNER_ZERO");

        __Ownable_init(_owner);
        __Pausable_init();

        entryPoint = _ep;
        policySigner = _signer;
        maxGasPerOp = 600_000;
        globalDailyLimit = 10 ether;

        isAdmin[_owner] = true;
        _admins.push(_owner);
    }

    modifier onlyEntryPoint() {
        if (msg.sender != address(entryPoint)) revert NotEntryPoint();
        _;
    }

    modifier onlyAdmin() {
        if (!isAdmin[msg.sender]) revert NotAdmin();
        _;
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "SIGNER_ZERO");
        emit SignerUpdated(policySigner, _signer);
        policySigner = _signer;
    }

    function setMaxGas(uint256 _max) external onlyOwner {
        require(_max > 0, "MAX_ZERO");
        emit MaxGasPerOpUpdated(maxGasPerOp, _max);
        maxGasPerOp = _max;
    }

    function setAllowed(address _addr, bool _allowed) external onlyAdmin {
        allowlist[_addr] = _allowed;
        emit AllowlistUpdated(_addr, _allowed);
    }

    function setAllowedBatch(address[] calldata _addrs, bool _allowed) external onlyAdmin {
        for (uint256 i = 0; i < _addrs.length; i++) {
            allowlist[_addrs[i]] = _allowed;
            emit AllowlistUpdated(_addrs[i], _allowed);
        }
    }

    function setDailyLimit(address _addr, uint256 _limit) external onlyAdmin {
        dailyLimit[_addr] = _limit;
        emit DailyLimitUpdated(_addr, _limit);
    }

    function setGlobalDailyLimit(uint256 _limit) external onlyOwner {
        globalDailyLimit = _limit;
        emit GlobalDailyLimitUpdated(_limit);
    }

    function addAdmin(address _admin) external onlyOwner {
        require(!isAdmin[_admin], "already admin");
        isAdmin[_admin] = true;
        _admins.push(_admin);
        emit AdminAdded(_admin);
    }

    function removeAdmin(address _admin) external onlyOwner {
        require(isAdmin[_admin], "admin not found");
        require(_admins.length > 1, "at least one admin required");
        isAdmin[_admin] = false;

        bool found = false;
        for (uint256 i = 0; i < _admins.length; i++) {
            if (_admins[i] == _admin) {
                _admins[i] = _admins[_admins.length - 1];
                _admins.pop();
                found = true;
                break;
            }
        }
        require(found, "admin not found");
        emit AdminRemoved(_admin);
    }

    function deposit() external payable onlyAdmin {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(address payable _to, uint256 _amount) external onlyOwner nonReentrant {
        entryPoint.withdrawTo(_to, _amount);
        emit Withdrawn(_to, _amount);
    }

    function emergencyWithdraw(address payable _to) external onlyOwner nonReentrant {
        uint256 balance = entryPoint.balanceOf(address(this));
        entryPoint.withdrawTo(_to, balance);
        emit EmergencyWithdraw(_to, balance);
    }

    function sweepNative(address payable _to) external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        (bool ok,) = _to.call{value: bal}("");
        require(ok, "sweep failed");
        emit SweptNative(_to, bal);
    }

    function getDeposit() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    function _currentDay() internal view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }

    function _saltKey(address sender, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(sender, salt));
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32,
        uint256 maxCost
    )
        external
        override
        onlyEntryPoint
        whenNotPaused
        returns (bytes memory context, uint256 validationData)
    {
        address sender = userOp.sender;
        if (!allowlist[sender]) revert NotAllowed();

        (uint128 pmVerificationGas, uint128 pmPostOpGas, Policy memory policy, bytes memory sig) =
            _decode(userOp.paymasterAndData);

        bytes32 saltKey = _saltKey(sender, policy.salt);

        if (usedSalts[saltKey]) revert SaltUsed();
        if (policy.sender != sender) revert NotAllowed();
        if (policy.version != 2) revert InvalidPolicyVersion();

        bytes32 agl = userOp.accountGasLimits;
        uint256 verificationGasLimit = uint128(uint256(agl) >> 128);
        uint256 callGasLimit = uint128(uint256(agl));

        uint256 totalGas =
            verificationGasLimit +
            callGasLimit +
            userOp.preVerificationGas +
            uint256(pmVerificationGas) +
            uint256(pmPostOpGas);

        if (totalGas > policy.maxGas || totalGas > maxGasPerOp) revert GasTooHigh();

        bytes32 gf = userOp.gasFees;
        uint256 maxFeePerGas = uint128(uint256(gf));
        if (maxFeePerGas == 0) revert ZeroMaxFeePerGas();

        uint256 estimatedCost = maxCost;

        uint256 userLimit = dailyLimit[sender] > 0 ? dailyLimit[sender] : globalDailyLimit;

        SpentInfo storage info = dailySpent[sender];
        uint64 today = _currentDay();
        if (info.day != today) {
            info.day = today;
            info.amount = 0;
        }
        if (info.amount + estimatedCost > userLimit) revert DailyLimitExceeded();
        info.amount += estimatedCost;

        bytes32 preHash = _preUserOpHash(userOp, pmVerificationGas, pmPostOpGas);
        bytes32 policyHash = keccak256(
            abi.encode(
                POLICY_TYPEHASH,
                preHash,
                policy.version,
                policy.sender,
                policy.validUntil,
                policy.validAfter,
                policy.maxGas,
                policy.salt
            )
        );

        bytes32 digest = policyHash.toEthSignedMessageHash();
        if (digest.recover(sig) != policySigner) revert InvalidSignature();

        usedSalts[saltKey] = true;
        validationData = _packValidation(policy.validUntil, policy.validAfter);

        emit Sponsored(sender, policy.salt, totalGas, maxFeePerGas);
        return ("", validationData);
    }

    function postOp(PostOpMode, bytes calldata, uint256, uint256) external override onlyEntryPoint { }

    function _preUserOpHash(
        PackedUserOperation calldata uo,
        uint128 pmVerificationGas,
        uint128 pmPostOpGas
    ) internal view returns (bytes32) {
      return keccak256(
          abi.encode(
              uo.sender,
              uo.nonce,
              keccak256(uo.initCode),
              keccak256(uo.callData),
              uo.accountGasLimits,
              uo.preVerificationGas,
              uo.gasFees,
              address(entryPoint),
              block.chainid,
              address(this),
              pmVerificationGas,
              pmPostOpGas
          )
      );
    }

    function _decode(bytes calldata data)
        internal
        view
        returns (uint128 pmVerificationGas, uint128 pmPostOpGas, Policy memory p, bytes memory sig)
    {
        require(data.length >= 20 + 16 + 16, "bad data");
        address prefix;
        assembly {
            prefix := shr(96, calldataload(data.offset))
            pmVerificationGas := shr(128, calldataload(add(data.offset, 20)))
            pmPostOpGas := shr(128, calldataload(add(data.offset, 36)))
        }
        require(prefix == address(this), "bad paymaster prefix");
        (p, sig) = abi.decode(data[52:], (Policy, bytes));
        require(sig.length == 65, "bad sig length");
    }

    function _packValidation(uint48 validUntil, uint48 validAfter) internal pure returns (uint256) {
        return (uint256(validAfter) << 208)
            | (uint256(validUntil == 0 ? type(uint48).max : validUntil) << 160);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function version() external pure returns (string memory) { return "1.0.0"; }
    function getAdmins() external view returns (address[] memory) { return _admins; }

    function getDailySpent(address _addr) external view returns (uint256) {
        SpentInfo storage info = dailySpent[_addr];
        if (info.day != _currentDay()) return 0;
        return info.amount;
    }

    uint256[50] private __gap;

    receive() external payable {}
}
