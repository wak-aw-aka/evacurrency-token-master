pragma solidity 0.5.8;


/**
 * @title Graceful
 *
 * This contract provides informative `require` with optional ability to `revert`.
 *
 * _softRequire is used when it's enough to return `false` in case if condition isn't fulfilled.
 * _hardRequire is used when it's necessary to make revert in case if condition isn't fulfilled.
 */
contract Graceful {
    event Error(bytes32 message);

    // Only for functions that return bool success before any changes made.
    function _softRequire(bool _condition, bytes32 _message) internal {
        if (_condition) {
            return;
        }
        emit Error(_message);
        // Return bytes32(0).
        assembly {
            mstore(0, 0)
            return(0, 32)
        }
    }

    // Generic substitution for require().
    function _hardRequire(bool _condition, bytes32 _message) internal pure {
        if (_condition) {
            return;
        }
        // Revert with bytes32(_message).
        assembly {
            mstore(0, _message)
            revert(0, 32)
        }
    }

    function _not(bool _condition) internal pure returns(bool) {
        return !_condition;
    }
}
