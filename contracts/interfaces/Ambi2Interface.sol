pragma solidity 0.5.8;


interface Ambi2Interface {
    function claimFor(address _address, address _owner) external returns(bool);
    function hasRole(address _from, bytes32 _role, address _to) external view returns(bool);
}
