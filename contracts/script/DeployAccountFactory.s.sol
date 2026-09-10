// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@account-abstraction/samples/SimpleAccountFactory.sol";
import "@account-abstraction/interfaces/IEntryPoint.sol";

contract DeployAccountFactory is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address entryPointAddr = vm.envAddress("ENTRYPOINT");

        vm.startBroadcast(deployerKey);

        SimpleAccountFactory factory = new SimpleAccountFactory(IEntryPoint(entryPointAddr));

        vm.stopBroadcast();

        console.log("SimpleAccountFactory:", address(factory));
    }
}
