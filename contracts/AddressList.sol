import './common/Owned.sol';

pragma solidity 0.5.8;


contract AddressList is Owned {
    string public name;

    mapping (address => bool) public onList;

    constructor(string memory _name, bool nullValue) public {
        name = _name;
        onList[address(0x0)] = nullValue;
    }

    event ChangeWhiteList(address indexed to, bool onList);

    // Set whether _to is on the list or not. Whether 0x0 is on the list
    // or not cannot be set here - it is set once and for all by the constructor.
    function changeList(address _to, bool _onList) public onlyContractOwner returns (bool success) {
        _softRequire(_to != address(0x0), 'Cannot set zero address');
        if (onList[_to] != _onList) {
            onList[_to] = _onList;
            emit ChangeWhiteList(_to, _onList);
        }
        return true;
    }
}
