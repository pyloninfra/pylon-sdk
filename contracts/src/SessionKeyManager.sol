// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SessionKeyManager is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct Session {
        address key;
        uint48 validUntil;
        uint48 validAfter;
        address[] allowedTargets;
        bytes4[] allowedSelectors;
        uint256 spendLimit;
        uint256 spent;
        bool active;
    }

    mapping(address => mapping(bytes32 => Session)) public sessions;

    event SessionCreated(address indexed wallet, bytes32 indexed sessionId, address key);
    event SessionRevoked(address indexed wallet, bytes32 indexed sessionId);
    event SessionUsed(address indexed wallet, bytes32 indexed sessionId, uint256 value);

    constructor(address _owner) Ownable(_owner) {}

    function createSession(
        bytes32 sessionId,
        address key,
        uint48 validUntil,
        uint48 validAfter,
        address[] calldata targets,
        bytes4[] calldata selectors,
        uint256 spendLimit
    ) external {
        sessions[msg.sender][sessionId] = Session({
            key: key,
            validUntil: validUntil,
            validAfter: validAfter,
            allowedTargets: targets,
            allowedSelectors: selectors,
            spendLimit: spendLimit,
            spent: 0,
            active: true
        });
        emit SessionCreated(msg.sender, sessionId, key);
    }

    function revokeSession(bytes32 sessionId) external {
        sessions[msg.sender][sessionId].active = false;
        emit SessionRevoked(msg.sender, sessionId);
    }

    function validateSession(
        address wallet,
        bytes32 sessionId,
        address target,
        bytes4 selector,
        uint256 value,
        bytes calldata signature
    ) external returns (bool) {
        require(msg.sender == wallet, "caller != wallet");
        Session storage s = sessions[wallet][sessionId];

        require(s.active, "inactive");
        require(block.timestamp >= s.validAfter, "not started");
        require(block.timestamp <= s.validUntil, "expired");
        require(s.spent + value <= s.spendLimit, "limit exceeded");

        bool targetAllowed = s.allowedTargets.length == 0;
        for (uint256 i = 0; i < s.allowedTargets.length && !targetAllowed; i++) {
            if (s.allowedTargets[i] == target) targetAllowed = true;
        }
        require(targetAllowed, "target not allowed");

        bool selectorAllowed = s.allowedSelectors.length == 0;
        for (uint256 i = 0; i < s.allowedSelectors.length && !selectorAllowed; i++) {
            if (s.allowedSelectors[i] == selector) selectorAllowed = true;
        }
        require(selectorAllowed, "selector not allowed");

        bytes32 hash =
            keccak256(abi.encode(wallet, sessionId, target, selector, value, block.chainid));
        require(hash.toEthSignedMessageHash().recover(signature) == s.key, "bad sig");

        s.spent += value;
        emit SessionUsed(wallet, sessionId, value);
        return true;
    }
}
