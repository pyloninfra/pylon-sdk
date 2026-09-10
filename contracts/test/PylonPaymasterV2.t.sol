// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PylonPaymasterV2.sol";

contract MockEntryPoint {
    mapping(address => uint256) public balances;
    function depositTo(address a) external payable { balances[a] += msg.value; }
    function balanceOf(address a) external view returns (uint256) { return balances[a]; }
    function withdrawTo(address payable a, uint256 v) external {
        require(balances[msg.sender] >= v, "insufficient balance");
        balances[msg.sender] -= v;
        a.transfer(v);
    }
    receive() external payable {}
}

contract PylonPaymasterV2Test is Test {
    PylonPaymasterV2 pm;
    MockEntryPoint ep;

    function setUp() public {
        ep = new MockEntryPoint();
        pm = new PylonPaymasterV2();
        pm.initialize(IEntryPoint(address(ep)), address(this), address(this));
        pm.setAllowed(address(this), true);
    }

    function testOwnerIsAdminByDefault() public {
        address[] memory admins = pm.getAdmins();
        assertEq(admins.length, 1);
        assertEq(admins[0], address(this));
        assertTrue(pm.isAdmin(address(this)));
    }

    function testDeposit() public {
        pm.deposit{value: 1 ether}();
        assertEq(pm.getDeposit(), 1 ether);
    }

    function testPauseUnpause() public {
        pm.pause();
        assertTrue(pm.paused());
        pm.unpause();
        assertFalse(pm.paused());
    }

    function testVersionMatchesScript() public {
        assertEq(pm.version(), "1.0.0");
    }
}
