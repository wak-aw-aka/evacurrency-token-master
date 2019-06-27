pragma solidity 0.5.8;

import './interfaces/RouterInterface.sol';
import './access/Ambi2Enabled.sol';


contract Router is RouterInterface, Ambi2Enabled {
    address internal prototype;
    event PrototypeUpdated(address newPrototype);

    function getPrototype() public view returns(address) {
        return prototype;
    }

    function updateVersion(address _newPrototype) public onlyRole('admin') returns(bool) {
        _softRequire(_newPrototype != address(0), 'Invalid new prototype');
        prototype = _newPrototype;
        emit PrototypeUpdated(_newPrototype);
        return true;
    }
}
