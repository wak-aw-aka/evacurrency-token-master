pragma solidity 0.5.8;


interface RouterInterface {
    function getPrototype() external view returns(address);
    function updateVersion(address _newPrototype) external returns(bool);
}
