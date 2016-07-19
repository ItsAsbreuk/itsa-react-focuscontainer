"use strict";

/**
 *
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 * @module focusmanager
 * @class FocusManager
 * @since 0.0.1
*/

require("itsa-jsext/lib/object");
require("itsa-jsext/lib/array");
require("itsa-dom");

const utils = require("itsa-utils"),
    isNode = utils.isNode,
    Event = require("itsa-event"),
    async = utils.async,
    SPECIAL_KEYS = [
        "shiftKey",
        "ctrlKey",
        "metaKey",
        "altKey"
    ],
    NATIVE_FOCUSSABLE_ELEMENTS = {
        BUTTON: true,
        INPUT: true,
        KEYGEN: true,
        SELECT: true,
        TEXTAREA: true
    },
    MAIN_CLASS = "itsa-focuscontainer",
    FOCUSCONTAINER_CLASS = "."+MAIN_CLASS,
    NESTED = MAIN_CLASS+"-nested",
    NESTED_CLASS = "."+NESTED,
    BLUR = "blur";

if (!isNode) {
    const nodeBlurred = function(e) {
        const node = e.target;
        if (node && node.hasAttribute && node.hasAttribute("itsa_dynamic_tabindex")) {
            node.removeAttribute("itsa_dynamic_tabindex");
            node.removeAttribute("tabIndex");
        }
    };
    if (window.addEventListener) {
        window.addEventListener(BLUR, nodeBlurred, true);
    }
    else {
        window.attachEvent("on"+BLUR, nodeBlurred);
    }
}

const specialKeyPressed = e => {
    let specialKeyPressed = false;
    SPECIAL_KEYS.some(value => {
        specialKeyPressed = !!e[value];
        return specialKeyPressed;
    });
    return specialKeyPressed;
};

const checkSpecialKeyMatch = (specialKeys, e) => {
    let allMatch;
    SPECIAL_KEYS.some(value => {
        let partOfSpecialKeys = specialKeys.itsa_contains(value);
        allMatch = (!!e[value]===partOfSpecialKeys);
        return !allMatch;
    });
    return allMatch;
};

const directionMatch = (keys, e, forbiddenKeys) => {
    let match = false;
    const keyCode = e.keyCode;
    keys.some(keyObj => {
        if (keyObj.key===keyCode) {
            // also check special key-match
            match = !forbiddenKeys[keyCode] &&
                    ((keyObj.special && checkSpecialKeyMatch(keyObj.special, e)) ||
                     (!keyObj.special && !specialKeyPressed(e)));
        }
        return match;
    });
    return match;
};

const tabIndexesOrder = (a, b) => {
    let tabA = parseInt(a.getAttribute("tabIndex"), 10),
        tabB = parseInt(b.getAttribute("tabIndex"), 10);
    if (tabB<tabA) {
        // put the new item `b` before previous item `a`
        return 1;
    }
    if (tabB>tabA) {
        // put the new item `b` behind previous item `a`
        return -1;
    }
    return 0;
};

const getFocussableNodes = (container, selector) => {
    let nodes, nodesWithoutTabIndexes, nodesWithTabIndexes, len, nextTabIndex;
    selector += ","+NESTED_CLASS;
    nodes = Array.prototype.filter.call(container.itsa_getAll(selector), node => {
        const insideContainer = node.itsa_inside(FOCUSCONTAINER_CLASS),
              insideOwnSelector = node.itsa_inside(selector);
        return ((insideContainer===container) &&
                !node.hasAttribute("data-itsa-fm-nofocus") &&
                (node.itsa_getStyle("display")!=="none") &&
                (node.itsa_getStyle("visibility")!=="hidden") &&
                !node.hasAttribute("disabled") &&
                !node.hasAttribute("readonly") &&
                !node.itsa_hasClass("disabled") &&
                !node.itsa_hasClass("readonly") &&
                (!insideOwnSelector || (insideContainer===insideOwnSelector) || !insideContainer.contains(insideOwnSelector)));
    });
    // now we create 2 intermediate arrays:
    // 1. those who have the `tabIndex` not set
    // 2. those who have the `tabIndex` set
    nodesWithoutTabIndexes = [];
    nodesWithTabIndexes = [];
    nodes.forEach(node => {
        let tabIndex = node.hasAttribute("itsa_dynamic_tabindex") ? undefined : node.getAttribute("tabIndex");
        if (typeof tabIndex==="string") {
            nodesWithTabIndexes.push(node);
        }
        else {
            nodesWithoutTabIndexes.push(node);
        }
    });
    // now, we order the nodelist with tabindexes:
    Array.prototype.sort.call(nodesWithTabIndexes, tabIndexesOrder);
    // Last step: we create a new list with all items in the right order:
    len = nodes.length;
    nodes.itsa_makeEmpty(); // reuse this array
    while (nodes.length<len) {
        if (nodesWithTabIndexes.length===0) {
            // no more nodes with tabIndexes --> fill `nodes` with remaining nodesWithoutTabIndexes
            Array.prototype.push.apply(nodes, nodesWithoutTabIndexes);
        }
        else if (nodesWithoutTabIndexes.length===0) {
            // no more nodes with tabIndexes --> fill `nodes` with remaining nodesWithTabIndexes
            Array.prototype.push.apply(nodes, nodesWithTabIndexes);
        }
        else {
            nextTabIndex = parseInt(nodesWithTabIndexes[0].getAttribute("tabIndex"), 10);
            if (nextTabIndex<=nodes.length) {
                // take node from `nodesWithTabIndexes`, add it to the `nodes` array and remove it from the `nodesWithTabIndexes`-array:
                nodes.push(nodesWithTabIndexes.shift());
            }
            else {
                // take node from `nodesWithTabIndexes`, add it to the `nodes` array and remove it from the `nodesWithTabIndexes`-array:
                nodes.push(nodesWithoutTabIndexes.shift());
            }
        }
    }
    return nodes;
};

const handleKey = function(component, e) {
    let nextIndex, count, activeElement, focussableNodes, getNextIndex, tagName, forbiddenKeys,
        parentcontainer, nestedcomponent, parentcomponent, getCurrentSelectedIndex;
    const props = component.props,
        selector = props.selector,
        loop = props.loop,
        transitionTime = props.transitionTime,
        container = component._domNode,
        disabled = props.disabled,
        keyCode = e.keyCode;

    getCurrentSelectedIndex = focussableNodes => {
        let index = focussableNodes.indexOf(activeElement);
        if (index>-1) {
            return index;
        }
        // now we check if it a descendent
        focussableNodes.some((node, i) => {
            if (node.contains(activeElement)) {
                index = i;
            }
            return (index>-1);
        });
        return index;
    },

    getNextIndex = (down, container, selector) => {
        focussableNodes = getFocussableNodes(container, selector);
        nextIndex = getCurrentSelectedIndex(focussableNodes) + (down ? 1 : -1);
        count = focussableNodes.length;
        if (down ? (nextIndex>=count) : (nextIndex<0)) {
            nextIndex = (loop && (count>0)) && (down ? 0 : count-1);
        }
        return nextIndex;
    };
    (keyCode===9) && e.preventDefault();
    if (disabled) {
        return;
    }
    activeElement = document.activeElement;
    if (activeElement.itsa_inside(FOCUSCONTAINER_CLASS)!==container) {
        return;
    }
    // be aware that arrow-key NEVER should match when the focus is set on an input/text/editable element!
    tagName = activeElement.tagName;
    if (tagName==="INPUT") {
        forbiddenKeys = {
            37: true, // arrowLeft
            39: true  // arrowRight
        };
    }
    else if (tagName==="TEXTAREA") {
        forbiddenKeys = {
            37: true, // arrowLeft
            39: true // arrowRight
        };
        ((activeElement.selectionStart!==0) || activeElement.selectionEnd) && (forbiddenKeys[38]=true); // arrowUp
        (activeElement.selectionStart<activeElement.textLength) && (forbiddenKeys[40]=true); // arrowDown
    }
    else if (activeElement.isContentEditable) {
        forbiddenKeys = {
            37: true, // arrowLeft
            38: true, // arrowUp
            39: true, // arrowRight
            40: true // arrowDown
        };
    }
    else {
        forbiddenKeys = {};
    }
    if (directionMatch(component._keysDown, e, forbiddenKeys)) {
        // keyDown direction
        nextIndex = getNextIndex(true, container, selector);
    }
    else if (directionMatch(component._keysUp, e, forbiddenKeys)) {
        // keyUp direction
        nextIndex = getNextIndex(false, container, selector);
    }
    if ((typeof nextIndex!=="number") && props.refocusOnEnterInput && (keyCode===13) && (e.target.tagName==="INPUT") && !e.target.hasAttribute("data-itsa-fm-nofocusonenter")) {
        // 'enter-key' is pressed on an input-element
        nextIndex = getNextIndex(true, container, selector);
    }
    if (typeof nextIndex==="number") {
        // focussing active focuscontainer
        setFocus({
            component,
            node: focussableNodes[nextIndex],
            transitionTime,
            focussableNodes
        });
    }
    else if (directionMatch(component._keysLeave, e, forbiddenKeys)) {
        // exitting nested focuscontainer
        parentcontainer = container.itsa_inside(FOCUSCONTAINER_CLASS);
        if (parentcontainer) {
            parentcomponent = parentcontainer._itsa_focuscontainer;
            setFocus({
                component: parentcomponent,
                node: container,
                transitionTime: parentcomponent.props.transitionTime,
                focussableNodes
            });
        }
    }
    else if ((activeElement.itsa_hasClass(NESTED)) && (activeElement!==container)) {
        // nested container
        nestedcomponent = activeElement._itsa_focuscontainer;
        if (nestedcomponent) {
            if (directionMatch(nestedcomponent._keysEnter, e, forbiddenKeys)) {
                // focussing item inside nested focuscontainer
                setFocus({
                    component: nestedcomponent,
                    index: nestedcomponent.state.index,
                    transitionTime: nestedcomponent.props.transitionTime,
                    focussableNodes
                });
            }
        }
    }
};

const setFocus = (config) => {
    const payload = {
        component: config.component,
        nodeOrIndex: config.node || config.index,
        transitionTime: config.transitionTime,
        focussableNodes: config.focussableNodes
    };
    Event.emit("focusmanager:focus", payload);
};

const defaultFnSetFocus = function(e) {
    let node, nextIndex;
    const component = e.component,
        nodeOrIndex = e.nodeOrIndex,
        transitionTime = e.transitionTime,
        props = component.props,
        selector = props.selector,
        container = component._domNode,
        focussableNodes = e.focussableNodes || getFocussableNodes(container, selector);
    if (focussableNodes.length===0) {
        nextIndex = null;
        node = container;
    }
    else {
        if (typeof nodeOrIndex==="number") {
            node = focussableNodes[nodeOrIndex];
            nextIndex = nodeOrIndex;
        }
        else {
            node = nodeOrIndex;
            nextIndex = focussableNodes.indexOf(node);
        }
        if (!focussableNodes.itsa_contains(node)) {
            nextIndex = 0;
            node = focussableNodes[0];
        }
    }
    if (node.setAttribute) {
        if (!NATIVE_FOCUSSABLE_ELEMENTS[node.tagName] && !node.hasAttribute("tabIndex")) {
            node.setAttribute("tabIndex", 0);
            node.setAttribute("itsa_dynamic_tabindex", "true");
        }
        // store the index in case the component looses its focus by itself, then we can reset the right index later on:
        component.setState({
            index: nextIndex,
            noResync: true // will not resync the component
        });
        return new Promise(resolve => {
            // we need to go async, otherwise the `focus`-event won't trigger a resync,
            // because `state.noResync` would still be `true`.
            async(() => {
                if (node===document.activeElement) {
                    node.itsa_scrollIntoView(null, null, transitionTime);
                }
                else {
                    node.itsa_focus && node.itsa_focus(null, null, transitionTime);
                }
                resolve(true);
            });
        });
    }
    else {
        return Promise.resolve(false);
    }
};

Event.defineEvent("focusmanager:focus").defaultFn(defaultFnSetFocus);

module.exports = {
    getFocussableNodes,
    handleKey,
    setFocus
};