var signet = (function () {
    'use strict';

    var supportedTypes = {
        '()': isType('string'),
        any: isType('string'),
        array: isInstanceOf(Array),
        boolean: isType('boolean'),
        function: isType('function'),
        number: isType('number'),
        object: isType('object'),
        string: isType('string'),
        symbol: isType('symbol'),
        undefined: isType('undefined')
    };

    // State rules for type lexer

    var lexRules = [
        function initRule(key, types) {
            return types.length === 1 ? 'accept' : 'init';
        },

        function failRule(key, types) {
            return isBadTypeList(types) ? 'fail' : key;
        }

    ];

    var lexStates = {
        init: lexRules,
        accept: lexRules,
        fail: [] // Always fails
    }

    // State rules for type verification

    var verifyRules = [
        function accept(key, typeObj, value) {
            return supportedTypes[typeObj.type](value, typeObj, isTypeOf) ? 'accept' : 'fail';
        },

        function skip(key, typeObj) {
            return typeObj.optional && key === 'fail' ? 'skip' : key;
        }
    ];

    var verificationStates = {
        skip: verifyRules,
        accept: verifyRules,
        fail: []
    };

    // State machine execution

    function updateState(states, stateKey, type, value) {
        return states[stateKey].reduce(function (key, rule) {
            return rule(key, type, value);
        }, stateKey);
    }

    var updateLexState = updateState.bind(null, lexStates);
    var updateVerificationState = updateState.bind(null, verificationStates);

    // Predicate functions

    function isType(type) {
        return function (value) {
            return type === typeof value;
        }
    }

    function isInstanceOf(obj) {
        return function (value) {
            return value instanceof obj;
        }
    }

    function matches(pattern) {
        return function (value) {
            return value.match(pattern) !== null;
        }
    }

    function isBadTypeList(types) {
        return types.length === 0 || types.filter(isTypeInvalid).length > 0;
    }

    function isTypeInvalid(typeObj) {
        var unsupportedType = !isType('function')(supportedTypes[typeObj.type]);
        var unsupportedSubtype = isType('string')(typeObj.subType) && typeObj.type !== 'object';

        return unsupportedType || unsupportedSubtype;
    }

    // Throw on error functions

    function throwOnTypeMismatch(type, value, message) {
        if (typeof value !== type) {
            throw new TypeError(message + ', you provided ' + typeof value);
        }
    }

    function throwOnInvalidSignature(tokenTree, userFn) {
        var shortTokenTree = tokenTree <= 1;
        var typesOkay = tokenTree.reduce(updateLexState, 'init') === 'accept';
        var lengthOkay = tokenTree[0].length >= userFn.length;

        var message = !lengthOkay ?
            'All function parameters are not accounted for in type definition' :
            'Invalid function signature; ensure all input and output paths are valid';

        if (!lengthOkay || shortTokenTree || !typesOkay) {
            throw new Error(message);
        }
    }

    function throwOnTypeState(failState, state, message) {
        if (state === failState) {
            throw new TypeError(message);
        }
    }

    // Utility functions

    function stripParens(token) {
        return matches(/^\(\s*\)$/)(token) ? token.replace(/\s*/g, '') : token.replace(/[()]/g, '');
    }

    function splitSignature(signature) {
        return signature.split(/\s*\=\>\s*/g);
    }

    // Metadata attachment

    function attachProp(userFn, propName, value) {
        Object.defineProperty(userFn, propName, {
            value: value,
            writeable: false
        });
    }

    function attachSignatureData(userFn, signature, tokenTree) {
        if (tokenTree.length > 1) {
            attachProp(userFn, 'signature', signature);
            attachProp(userFn, 'signatureTree', tokenTree);
        }

        return userFn;
    }

    // Type construction

    function buildTypeObj(token) {
        var splitType = token.replace(/[\[\]]/g, '').split(/\s*(\<|\:)\s*/);

        var type = splitType[0];
        var secondaryType = splitType.length > 1 ? splitType.pop().trim() : undefined;
        var isValueType = isType('string')(secondaryType) && (type === 'array' || token.match(/^[^\<]+\<[^\>]+\>$/) !== null);

        return {
            type: type,
            subType: !isValueType ? secondaryType : undefined,
            valueType: isValueType ? secondaryType.substring(0, secondaryType.length - 1).split(/\s*\;+\s*/g) : undefined,
            optional: matches(/\[[^\]]+\]/)(token)
        };
    }

    function buildTypeTree(rawToken) {
        return stripParens(rawToken.trim())
            .split(/\s*\,\s*/g)
            .map(buildTypeObj);
    }

    function buildTypeStr(typeObj) {
        var typeStr = typeObj.type;
        
        if(!isType('undefined')(typeObj.valueType)) {
            typeStr += '<' + typeObj.valueType.join(';') + '>';
        }
        
        return typeStr;
    }

    // Verification mutually recursive behavior

    function getNextArgs(state, args) {
        return state === 'skip' ? args : args.slice(1);
    }

    function isVerificationComplete(nextSignature, nextArgs) {
        return nextSignature.length === 0 || nextArgs.length === 0;
    }

    function nextVerificationStep(inputSignature, args, state) {
        var errorMessage = 'Expected type ' + buildTypeStr(inputSignature[0]) + ' but got ' + typeof args[0];

        var nextSignature = inputSignature.slice(1);
        var nextArgs = getNextArgs(state, args);
        var done = isVerificationComplete(nextSignature, nextArgs);

        throwOnTypeState('fail', state, errorMessage);

        return !done ? verifyOnState(nextSignature, nextArgs, state) : state;
    }

    function verifyOnState(inputSignature, args, inState) {
        var state = isType('undefined')(inState) ? 'accept' : inState;
        var outState = updateVerificationState(state, inputSignature[0], args[0]);

        return nextVerificationStep(inputSignature, args, outState);
    }

    // Type enforcement setup and behavior

    function buildWrapperArgs(signedFn, args) {
        var done = signedFn.length <= args.length;

        return !done ? buildWrapperArgs(signedFn, args.concat(['x' + args.length])) : args.join(',');
    }

    function callAndEnforce(signedFn, args) {
        var result = signedFn.apply(null, args);
        var signature = splitSignature(signedFn.signature).slice(1).join(' => ');
        var tokenTree = signedFn.signatureTree.slice(1);

        attachSignatureData(result, signature, tokenTree);

        return tokenTree.length > 1 ? enforce(result) : result;
    }

    function buildEnforceWrapper(signedFn) {
        var wrapperTemplate = 'return function enforceWrapper (' + buildWrapperArgs(signedFn, []) + ') {' +
            'verify(signedFn, arguments);' +
            'return callAndEnforce(signedFn, Array.prototype.slice.call(arguments));' +
            '};';

        var wrapperFn = new Function(['signedFn', 'verify', 'callAndEnforce'], wrapperTemplate);

        return wrapperFn(signedFn, verify, callAndEnforce);
    }

    // Core functionality

    function sign(signature, userFn) {
        var tokenTree = splitSignature(signature).map(buildTypeTree);

        throwOnInvalidSignature(tokenTree, userFn);

        return attachSignatureData(userFn, signature, tokenTree);
    }

    function verify(signedFn, args) {
        var finalState = verifyOnState(signedFn.signatureTree[0], Array.prototype.slice.call(args, 0));

        throwOnTypeState('skip', finalState, 'Optional types were not fulfilled properly');
    }

    function enforce(signedFn) {
        var enforcementWrapper = buildEnforceWrapper(signedFn);

        attachProp(enforcementWrapper, 'signature', signedFn.signature);
        attachProp(enforcementWrapper, 'signatureTree', signedFn.signatureTree);
        attachProp(enforcementWrapper, 'toString', signedFn.toString.bind(signedFn));

        return enforcementWrapper;
    }

    var signAndEnforce = function (signature, userFn) {
        return enforce(sign(signature, userFn));
    }

    function extend(key, predicate) {
        if (typeof supportedTypes[key] !== 'undefined') {
            throw new Error('Cannot redefine type ' + key);
        }

        supportedTypes[key] = predicate;
    }

    function subtype(existingType) {
        var typeSignature = existingType + ', object, function => boolean';

        return function (key, predicate) {
            var enforcedPredicate = signAndEnforce(typeSignature, predicate);
            extend(key, enforcedPredicate);
        }
    }

    function alias (key, typedef){
        extend(key, isTypeOf(typedef));
    }

    function isTypeOf(typeStr) {
        var typeObj = buildTypeObj(typeStr);
        
        return function (value) {
            var result = true;
            
            try {
                result = supportedTypes[typeObj.type](value, typeObj);
            } catch (e) {
                result = false;
            }
            
            return result;
        };
    }

    // Final module definition

    var signet = {
        alias: signAndEnforce('string, string => undefined', alias),
        enforce: signAndEnforce('string, function => function', signAndEnforce),
        extend: signAndEnforce('string, function => undefined', extend),
        isTypeOf: isTypeOf,
        sign: signAndEnforce('string, function => function', sign),
        subtype: signAndEnforce('string => string, function => undefined', subtype),
        verify: signAndEnforce('function, object => undefined', verify)
    };

    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = signet;
    }

    return signet;

})();

(function () {
    'use strict';

    signet.subtype('number')('int', intType);

    function intType(value) {
        return Math.floor(value) === value;
    }

    signet.subtype('number')('bounded', boundedType);

    function boundedType(value, typeObj) {
        var lowerBound = parseInt(typeObj.valueType[0], 10);
        var upperBound = parseInt(typeObj.valueType[1], 10);
        
        return lowerBound <= value && value <= upperBound;
    }

    signet.subtype('int')('boundedInt', boundedIntType);

    function boundedIntType(value, typeObj) {
        var boundStr = 'bounded<' + typeObj.valueType.join(';') + '>';
        return signet.isTypeOf(boundStr)(value);
    }

    signet.subtype('array')('tuple', tupleType);
    
    function checkType (tuple, type, index){
        return signet.isTypeOf(type)(tuple[index]);
    }
    
    function tupleType(tuple, typeObj) {
        return tuple.length === typeObj.valueType.length &&
               typeObj.valueType
                    .map(checkType.bind(null, tuple))
                    .reduce(function (a, b) { return a && b; }, true);
    }

    signet.subtype('string')('boundedString', boundedStringType);
    
    function boundedStringType (valueStr, typeObj){
        var lowerBound = parseInt(typeObj.valueType[0], 10);
        var upperBound = typeObj.valueType.length > 1 ? parseInt(typeObj.valueType[1], 10) : valueStr.length;
        
        return lowerBound <= valueStr.length && valueStr.length <= upperBound;
    }

    signet.subtype('string')('formattedString', formattedStringType);
    
    function formattedStringType (valueStr, typeObj){
        var pattern = new RegExp(typeObj.valueType[0]);
        
        return valueStr.match(pattern) !== null;
    }

    signet.extend('taggedUnion', taggedUnionType);
    
    function taggedUnionType (value, typeObj){
        return typeObj.valueType.reduce(function (result, type) {
            return result || signet.isTypeOf(type)(value);
        }, false);
    }

    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = signet;
    }

})();