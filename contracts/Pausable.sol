import './common/Owned.sol';

pragma solidity 0.5.8;


contract Pausable is Owned {
    event Paused();
    event Unpaused();

    bool public paused = false;

    /**
    * @dev Modifier to make a function callable only when the contract is not paused.
    */
    modifier whenNotPaused() {
        require(_not(paused), 'Paused');
        _;
    }

    /**
    * @dev Modifier to make a function callable only when the contract is paused.
    */
    modifier whenPaused() {
        require(paused, 'Not paused');
        _;
    }

    /**
    * @dev called by the owner to pause, triggers stopped state
    */
    function pause() public onlyContractOwner whenNotPaused {
        paused = true;
        emit Paused();
    }

    /**
    * @dev called by the owner to unpause, returns to normal state
    */
    function unpause() public onlyContractOwner whenPaused {
        paused = false;
        emit Unpaused();
    }
}
