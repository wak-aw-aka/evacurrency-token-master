pragma solidity 0.5.8;

import './Graceful.sol';


/**
 * @title Owned
 *
 * This contract keeps and transfers contract ownership.
 *
 * After deployment msg.sender becomes an owner which is checked in modifier onlyContractOwner().
 *
 * Features:
 * Modifier onlyContractOwner() restricting access to function for all callers except the owner.
 * Functions of transferring ownership to another address.
 *
 * Note:
 * Function forceChangeContractOwnership allows to
 * transfer the ownership to an address without confirmation.
 * Which is very convenient in case the ownership transfers to a contract.
 * But when using this function, it's important to be very careful when entering the address.
 * Check address three times to make sure that this is the address that you need
 * because you can't cancel this operation.
 */
contract Owned is Graceful {
    bool public isConstructedOwned;
    address public contractOwner;
    address public pendingContractOwner;

    event ContractOwnerChanged(address newContractOwner);
    event PendingContractOwnerChanged(address newPendingContractOwner);

    constructor() public {
        constructOwned();
    }

    function constructOwned() public returns(bool) {
        if (isConstructedOwned) {
            return false;
        }
        isConstructedOwned = true;
        contractOwner = msg.sender;
        emit ContractOwnerChanged(msg.sender);
        return true;
    }

    modifier onlyContractOwner() {
        _softRequire(contractOwner == msg.sender, 'Not a contract owner');
        _;
    }

    function changeContractOwnership(address _to) public onlyContractOwner() returns(bool) {
        pendingContractOwner = _to;
        emit PendingContractOwnerChanged(_to);
        return true;
    }

    function claimContractOwnership() public returns(bool) {
        _softRequire(pendingContractOwner == msg.sender, 'Not a pending contract owner');
        contractOwner = pendingContractOwner;
        delete pendingContractOwner;
        emit ContractOwnerChanged(contractOwner);
        return true;
    }

    function forceChangeContractOwnership(address _to) public onlyContractOwner() returns(bool) {
        contractOwner = _to;
        emit ContractOwnerChanged(contractOwner);
        return true;
    }
}
