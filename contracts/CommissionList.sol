import './common/Owned.sol';
import './common/SafeMath.sol';

pragma solidity 0.5.8;


contract CommissionList is Owned {
    using SafeMath for uint256;

    struct CommissionInfo {
        uint256 stat;
        uint256 perc;
    }

    uint256 internal constant ONE_HUNDRED_PERCENT = 10000;

    mapping (string => CommissionInfo) internal refillPaySystemInfo;
    mapping (string => CommissionInfo) internal withdrawPaySystemInfo;

    CommissionInfo internal transferInfo;

    event RefillCommissionIsChanged(string paySystem, uint256 stat, uint256 perc);
    event WithdrawCommissionIsChanged(string paySystem, uint256 stat, uint256 perc);
    event TransferCommissionIsChanged(uint256 stat, uint256 perc);

    function setRefillFor(string memory _paySystem, uint256 _stat, uint256 _perc)
    public onlyContractOwner returns (bool success) {
        _softRequire(_perc <= ONE_HUNDRED_PERCENT, 'perc is out of 100% range');

        refillPaySystemInfo[_paySystem] = CommissionInfo(_stat, _perc);

        emit RefillCommissionIsChanged(_paySystem, _stat, _perc);

        return true;
    }

    function setWithdrawFor(string memory _paySystem, uint256 _stat, uint256 _perc)
    public onlyContractOwner returns (bool success) {
        _softRequire(_perc <= ONE_HUNDRED_PERCENT, 'perc is out of 100% range');

        withdrawPaySystemInfo[_paySystem] = CommissionInfo(_stat, _perc);

        emit WithdrawCommissionIsChanged(_paySystem, _stat, _perc);

        return true;
    }

    function setTransfer(uint256 _stat, uint256 _perc)
    public onlyContractOwner returns (bool success) {
        _softRequire(_perc <= ONE_HUNDRED_PERCENT, 'perc is out of 100% range');

        transferInfo = CommissionInfo(_stat, _perc);

        emit TransferCommissionIsChanged(_stat, _perc);

        return true;
    }

    function getRefillPercFor(string memory _paySystem) public view returns (uint256) {
        return refillPaySystemInfo[_paySystem].perc;
    }

    function getRefillStatFor(string memory _paySystem) public view returns (uint256) {
        return refillPaySystemInfo[_paySystem].stat;
    }

    function getWithdrawPercFor(string memory _paySystem) public view returns (uint256) {
        return withdrawPaySystemInfo[_paySystem].perc;
    }

    function getWithdrawStatFor(string memory _paySystem) public view returns (uint256) {
        return withdrawPaySystemInfo[_paySystem].stat;
    }

    function getTransferPerc() public view returns (uint256) {
        return transferInfo.perc;
    }

    function getTransferStat() public view returns (uint256) {
        return transferInfo.stat;
    }

    function calcWithdraw(string memory _paySystem, uint256 _value) public view returns(uint256) {
        return (_value * withdrawPaySystemInfo[_paySystem].perc)/ONE_HUNDRED_PERCENT +
            withdrawPaySystemInfo[_paySystem].stat;
    }

    function calcRefill(string memory _paySystem, uint256 _value) public view returns(uint256) {
        return (_value * refillPaySystemInfo[_paySystem].perc)/ONE_HUNDRED_PERCENT +
            refillPaySystemInfo[_paySystem].stat;
    }

    function calcTransfer(uint256 _value) public view returns(uint256) {
        return (_value * transferInfo.perc)/ONE_HUNDRED_PERCENT + transferInfo.stat;
    }
}
