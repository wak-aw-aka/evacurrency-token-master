pragma solidity 0.5.8;

import '../interfaces/Ambi2Interface.sol';
import '../common/Graceful.sol';


contract Ambi2Enabled is Graceful {
    Ambi2Interface public ambi2;

    modifier onlyRole(bytes32 _role) {
        Ambi2Interface ambi2Interface = ambi2;
        _softRequire(address(ambi2Interface) != address(0x0) &&
            ambi2Interface.hasRole(address(this), _role, msg.sender),
            'Sender access denied');
        _;
    }

    // Setup and claim atomically.
    function setupAmbi2(Ambi2Interface _ambi2) public returns(bool) {
        _softRequire(address(ambi2) == address(0x0), 'Ambi2 already set');
        _softRequire(address(_ambi2) != address(0x0), 'Invalid Ambi2 address');
        _softRequire(_ambi2.claimFor(address(this), msg.sender), 'Claim failed');

        ambi2 = _ambi2;
        return true;
    }
}
