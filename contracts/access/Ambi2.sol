pragma solidity 0.5.8;

import '../interfaces/Ambi2Interface.sol';

/* solhint-disable not-rely-on-time */

contract Ambi2 is Ambi2Interface {
    bytes32 internal constant OWNER = '__root__';

    uint256 internal constant LIFETIME =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    mapping(bytes32 => uint) internal rolesExpiration;
    mapping(address => bool) internal nodes;

    event Assign(address indexed from, bytes32 indexed role, address indexed to,
        uint256 expirationDate);

    event Unassign(address indexed from, bytes32 indexed role, address indexed to);
    event Error(bytes32 message);

    modifier onlyNodeOwner(address _node) {
        if (isOwner(_node, msg.sender)) {
            _;
        } else {
            _error('Access denied: only node owner');
        }
    }

    function claimFor(address _address, address _owner) public returns(bool) {
        if (nodes[_address]) {
            _error('Access denied: already owned');
            return false;
        }
        nodes[_address] = true;
        _assignRole(_address, OWNER, _owner, LIFETIME);
        return true;
    }

    function claim(address _address) public returns(bool) {
        return claimFor(_address, msg.sender);
    }

    function assignOwner(address _node, address _owner) public returns(bool) {
        return assignRole(_node, OWNER, _owner);
    }

    function assignRole(address _from, bytes32 _role, address _to) public returns(bool) {
        return assignRoleWithExpiration(_from, _role, _to, LIFETIME);
    }

    function assignRoleWithExpiration(
        address _from, bytes32 _role, address _to, uint256 _expirationDate
    ) public onlyNodeOwner(_from) returns(bool) {
        if (hasRole(_from, _role, _to) &&
            rolesExpiration[_getRoleSignature(_from, _role, _to)] == _expirationDate) {
            _error('Role already assigned');
            return false;
        }
        if (_isPast(_expirationDate)) {
            _error('Invalid expiration date');
            return false;
        }

        _assignRole(_from, _role, _to, _expirationDate);
        return true;
    }

    function _assignRole(address _from, bytes32 _role, address _to, uint256 _expirationDate)
    internal {
        rolesExpiration[_getRoleSignature(_from, _role, _to)] = _expirationDate;
        emit Assign(_from, _role, _to, _expirationDate);
    }

    function unassignOwner(address _node, address _owner) public returns(bool) {
        if (_owner == msg.sender) {
            _error('Cannot remove ownership');
            return false;
        }

        return unassignRole(_node, OWNER, _owner);
    }

    function unassignRole(address _from, bytes32 _role, address _to)
    public onlyNodeOwner(_from) returns(bool) {
        if (!hasRole(_from, _role, _to)) {
            _error('Role not assigned');
            return false;
        }

        delete rolesExpiration[_getRoleSignature(_from, _role, _to)];
        emit Unassign(_from, _role, _to);
        return true;
    }

    function hasRole(address _from, bytes32 _role, address _to) public view returns(bool) {
        return _isFuture(rolesExpiration[_getRoleSignature(_from, _role, _to)]);
    }

    function isOwner(address _node, address _owner) public view returns(bool) {
        return hasRole(_node, OWNER, _owner);
    }

    function _error(bytes32 _message) internal {
        emit Error(_message);
    }

    function _getRoleSignature(address _from, bytes32 _role, address _to)
    internal pure returns(bytes32) {
        return keccak256(abi.encodePacked(_from, _role, _to));
    }

    function _isPast(uint256 _timestamp) internal view returns(bool) {
        return _timestamp < now;
    }

    function _isFuture(uint256 _timestamp) internal view returns(bool) {
        return !_isPast(_timestamp);
    }
}
