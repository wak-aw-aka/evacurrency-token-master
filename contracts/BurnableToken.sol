import './BasicToken.sol';

pragma solidity 0.5.8;


contract BurnableToken is BasicToken {
    event Burn(address indexed holder, uint256 value);

    /**
    * @dev Burns a specific amount of tokens.
    * @param _value The amount of token to be burned.
    */
    // solhint-disable-next-line no-simple-event-func-name
    function burn(uint256 _value) public returns (bool success) {
        return _burn(msg.sender, _value);
    }

    function _burn(address _holder, uint256 _value) internal returns (bool success) {
        require(_value <= balances[_holder]);

        balances[_holder] = balances[_holder] - _value;
        totalSupply_ = totalSupply_ - _value;
        emit Burn(_holder, _value);
        emit Transfer(_holder, address(0), _value);

        return true;
    }
}
