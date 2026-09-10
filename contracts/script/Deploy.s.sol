// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@account-abstraction/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/PylonPaymasterV2.sol";
import "../src/SessionKeyManager.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address ep = vm.envAddress("ENTRYPOINT");
        address owner = vm.addr(pk);
        address signer = owner;

        vm.startBroadcast(pk);

        PylonPaymasterV2 impl = new PylonPaymasterV2();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(PylonPaymasterV2.initialize, (IEntryPoint(ep), owner, signer))
        );

        SessionKeyManager skm = new SessionKeyManager(owner);

        vm.stopBroadcast();

        console.log("PylonPaymasterV2 implementation:", address(impl));
        console.log("PylonPaymasterV2 proxy (use as PAYMASTER_ADDRESS):", address(proxy));
        console.log("SessionKeyManager:", address(skm));
    }
}
