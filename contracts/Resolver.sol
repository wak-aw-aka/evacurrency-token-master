pragma solidity 0.5.8;

import './interfaces/RouterInterface.sol';


contract Resolver {
    address internal constant PLACEHOLDER = 0xCAfEcAfeCAfECaFeCaFecaFecaFECafECafeCaFe;

    function () external payable {
        address prototype = RouterInterface(PLACEHOLDER).getPrototype();
        assembly {
            let calldatastart := 0
            calldatacopy(calldatastart, 0, calldatasize)
            let res := delegatecall(gas, prototype, calldatastart, calldatasize, 0, 0)
            let returndatastart := 0
            returndatacopy(returndatastart, 0, returndatasize)
            switch res case 0 { revert(returndatastart, returndatasize) }
                default { return(returndatastart, returndatasize) }
        }
    }
}
