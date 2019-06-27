import './PausableToken.sol';
import './BurnableToken.sol';
import './CommissionList.sol';
import './AddressList.sol';
import './common/SafeMath.sol';

pragma solidity 0.5.8;


contract EvaCurrency is PausableToken, BurnableToken {
    using SafeMath for uint256;

    string public name;
    string public symbol;

    CommissionList public commissionList;
    AddressList public moderList;

    // solhint-disable-next-line const-name-snakecase
    uint8 internal constant baseUnit = 2;

    mapping(address => uint) public lastUsedNonce;

    address public staker;

    event Mint(address holder, uint256 amount);
    event StakerChanged(address oldStaker, address newStaker);
    event ListsSet(CommissionList commissionList, AddressList addList);

    constructor() public {
        _constructEvaCurrency('lockPrototype', 'lockPrototype');
    }

    function isConstructableEvaCurrency() public view returns(bool) {
        return contractOwner == address(0);
    }

    function _constructEvaCurrency(string memory _name, string memory _symbol) internal {
        contractOwner = msg.sender;
        staker = msg.sender;
        name = _name;
        symbol = _symbol;
    }

    function constructEvaCurrency(string memory _name, string memory _symbol) public {
        require(isConstructableEvaCurrency(), 'Contract owner is already set');
        _constructEvaCurrency(_name, _symbol);
    }

    function decimals() public view returns(uint8) {
        return baseUnit;
    }

    function setLists(CommissionList _commissionList, AddressList _moderList)
    public onlyContractOwner returns(bool success) {
        commissionList = _commissionList;
        moderList = _moderList;
        emit ListsSet(commissionList, moderList);

        return true;
    }

    modifier onlyModer() {
        require(moderList.onList(msg.sender), 'Called not by moder');
        _;
    }

    function transferOnBehalf(address _to, uint256 _amount, uint256 _nonce, uint8 _v, bytes32 _r,
        bytes32 _s)
    public onlyModer whenNotPaused returns (bool success) {
        uint256 fee;
        uint256 resultAmount;
        bytes32 hash = keccak256(abi.encodePacked(_to, _amount, _nonce, address(this)));
        address sender = ecrecover(hash, _v, _r, _s);

        _softRequire(lastUsedNonce[sender] < _nonce, 'Invalid nonce');

        fee = commissionList.calcTransfer(_amount);
        resultAmount = _amount.add(fee);

        _softRequire(balances[sender] >= resultAmount, 'Insufficient funds');

        balances[sender] = balances[sender] - resultAmount;
        balances[_to] = balances[_to] + _amount;
        balances[staker] = balances[staker] + fee;
        lastUsedNonce[sender] = _nonce;

        emit Transfer(sender, _to, _amount);
        emit Transfer(sender, staker, fee);
        return true;
    }

    function withdrawOnBehalf(uint256 _amount, string memory _paySystem, uint256 _nonce, uint8 _v,
        bytes32 _r, bytes32 _s)
    public onlyModer whenNotPaused returns (bool success) {
        uint256 fee;
        uint256 resultAmount;
        bytes32 hash = keccak256(abi.encodePacked(address(0), _amount, _nonce, address(this)));
        address sender = ecrecover(hash, _v, _r, _s);

        _softRequire(lastUsedNonce[sender] < _nonce, 'Invalid nonce');

        fee = commissionList.calcWithdraw(_paySystem, _amount);

        _softRequire(_amount > fee, 'Fee is more than value');
        _softRequire(balances[sender] >= _amount, 'Insufficient funds');

        resultAmount = _amount - fee;

        balances[sender] = balances[sender] - _amount;
        balances[staker] = balances[staker] + fee;
        totalSupply_ = totalSupply_ - resultAmount;
        lastUsedNonce[sender] = _nonce;

        emit Burn(sender, resultAmount);
        emit Transfer(sender, address(0), resultAmount);
        emit Transfer(sender, staker, fee);
        return true;
    }

    function refill(address _to, uint256 _amount, string memory _paySystem)
    public onlyModer whenNotPaused returns (bool success) {
        uint256 fee;
        uint256 resultAmount;

        fee = commissionList.calcRefill(_paySystem, _amount);
        resultAmount = _amount.add(fee);

        balances[_to] = balances[_to] + _amount;
        balances[staker] = balances[staker] + fee;
        totalSupply_ = totalSupply_.add(resultAmount);

        emit Mint(_to, resultAmount);
        emit Transfer(address(0), _to, resultAmount);
        emit Transfer(_to, staker, fee);
        return true;
    }

    function changeStaker(address _staker) public onlyContractOwner returns(bool success) {
        address oldStaker = staker;
        staker = _staker;

        emit StakerChanged(oldStaker, staker);
        return true;
    }
}
