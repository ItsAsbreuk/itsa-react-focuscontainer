"use strict";

/**
 * Description here
 *
 *
 *
 * <i>Copyright (c) 2016 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @module component.jsx
 * @class Component
 * @since 15.0.0
*/

require("itsa-dom");
require("itsa-jsext");

const React = require("react"),
    PropTypes = require("prop-types"),
    MAIN_CLASS = "itsa-focuscontainer",
    MAIN_CLASS_PREFIX = MAIN_CLASS+"-",
    FOCUSCONTAINER_CLASS = "."+MAIN_CLASS,
    async = require("itsa-utils").async,
    focusmanager = require("./focusmanager"),
    NATIVE_FOCUSSABLE_ELEMENTS = {
        BUTTON: true,
        INPUT: true,
        KEYGEN: true,
        SELECT: true,
        TEXTAREA: true
    },
    SPECIAL_KEYS = {
        shift: "shiftKey",
        ctrl: "ctrlKey",
        cmd: "metaKey",
        alt: "altKey"
    };

class Component extends React.Component {
    constructor(props) {
        super(props);
        const instance = this;
        instance.state = {
            index: 0,
            focussed: false,
            hasActiveFocus: false
        };
        instance.defineMovementKeys = instance.defineMovementKeys.bind(instance);
        instance.focusActiveElement = instance.focusActiveElement.bind(instance);
        instance.focusElement = instance.focusElement.bind(instance);
        instance.getFocussableNodes = instance.getFocussableNodes.bind(instance);
        instance.handleBlur = instance.handleBlur.bind(instance);
        instance.handleClick = instance.handleClick.bind(instance);
        instance.handleFocus = instance.handleFocus.bind(instance);
        instance.isNestedContainer = instance.isNestedContainer.bind(instance);
        instance.setInitialFocus = instance.setInitialFocus.bind(instance);
    }

    /**
     * componentDidMount will set an eventlistener to the `app:passwordresetrequest`-event
     *
     * @method componentDidMount
     * @since 15.0.0
     */
    componentDidMount() {
        const instance = this,
            props = instance.props,
            onMount = props.onMount;
        instance._domNode._itsa_focuscontainer = instance; // to have a reference to the instance
        // on every render-cycle, we need to re-calculate this._keysUp and this._keysDown:
        instance.defineMovementKeys();
        if (props.initialFocus!==undefined) {
            instance.setInitialFocus();
        }
        onMount && onMount();
    }

    componentDidUpdate() {
        // VERY IMPORTANT: when re-rendered, the content might be changed.
        // Therefore, if the activeElement is outside the container: we reset the focus.
        // We CANNOT check for state.focussed, because this will mislead us
        // when we have nested focuscontainers. Therefore inspect state.hasActiveFocus
        const instance = this,
            state = instance.state;
        if (state.hasActiveFocus && !instance._updatedFromHandleFocus && !instance._domNode.contains(document.activeElement)) {
            focusmanager.setFocus({
                component: instance,
                index: state.index,
                transitionTime: this.props.transitionTime
            });
        }
    }

    componentWillUpdate() {
        this.defineMovementKeys();
    }

    /**
     * Extracts this.props.keyUp and this.props.keyDown into an array of `objects`
     * and defines them into this._keysUp and this._keysDown.
     *
     * @method defineMovementKeys
     * @since 15.0.0
     */
    defineMovementKeys() {
        const props = this.props;
        let keyUp = props.keyUp,
            keyDown = props.keyDown,
            keyEnter = props.keyEnter,
            keyLeave = props.keyLeave,
            getObjectArray;
        getObjectArray = (keys) => {
            return keys.map(key => {
                let splitted;
                if (typeof key==="number") {
                    return {
                        key
                    };
                }
                if (key.itsa_contains("+")) {
                    // special key present
                    splitted = key.split("+");
                    return {
                        key: parseInt(splitted.pop(), 10),
                        special: splitted.map(item => SPECIAL_KEYS[item])
                    };
                }
                return {
                    key: parseInt(key, 10)
                };
            });
        };
        // first handle keyUp:
        Array.isArray(keyUp) || (keyUp=[keyUp]);
        this._keysUp = getObjectArray(keyUp);
        // next keyDown:
        Array.isArray(keyDown) || (keyDown=[keyDown]);
        this._keysDown = getObjectArray(keyDown);
        // next keyEnter:
        Array.isArray(keyEnter) || (keyEnter=keyEnter ? [keyEnter] : []);
        this._keysEnter = getObjectArray(keyEnter);
        // next keyLeave:
        Array.isArray(keyLeave) || (keyLeave=[keyLeave]);
        this._keysLeave = getObjectArray(keyLeave);
    }

    /**
     * Sets the focus on the active Element of the Container.
     *
     * @method focusActiveElement
     * @chainable
     * @since 0.0.1
     */
    focusActiveElement() {
        const instance = this;
        focusmanager.setFocus({
            component: instance,
            index: instance.state.index,
            transitionTime: instance.props.transitionTime
        });
    }

    /**
     * Sets the focus on the specified Element of the Container.
     *
     * @method focusElement
     * @param index {Number} the index of the item to be focussed
     * @chainable
     * @since 0.0.1
     */
    focusElement(index) {
        const instance = this;
        (index<0) && (index=0);
        focusmanager.setFocus({
            component: instance,
            index: index,
            transitionTime: instance.props.transitionTime
        });
    }

    getFocussableNodes() {
        return focusmanager.getFocussableNodes(this._domNode, this.props.selector);
    }

    handleBlur() {
        this.setState({
            focussed: false,
            hasActiveFocus: false
        });
    }

    handleClick(e) {
        let parentNode, newIndex, newNode, containerClick, checkContainerClick, nested;
        const instance = this,
            node = e.target,
            container = instance._domNode,
            props = instance.props,
            focusOnContainerClick = props.focusOnContainerClick,
            selector = props.selector,
            onClick = props.onClick,
            nativeFocussableElement = !!NATIVE_FOCUSSABLE_ELEMENTS[node.tagName];

        checkContainerClick = () => {
            let focussableNodeClick = false,
                focussableNodes = focusmanager.getFocussableNodes(container, selector);
            focussableNodes.some(focussableNode => {
                focussableNodeClick = focussableNode.contains(node);
                return focussableNodeClick;
            });
            return !focussableNodeClick;
        };
        containerClick = focusOnContainerClick && checkContainerClick();
        if (!containerClick || ((node!==container) && (nested=(node.itsa_inside(FOCUSCONTAINER_CLASS)!==container)))) {
            onClick && onClick(e, nested);
            return;
        }
        if (containerClick || !nativeFocussableElement ||
            (!node.matchesSelector(selector) && (parentNode=e.target.itsa_inside(selector)) && !instance._domNode.contains(parentNode))) {
            if (containerClick || nativeFocussableElement) {
                newIndex = instance.state.index;
            }
            else {
                newNode = node;
            }
            focusmanager.setFocus({
                component: instance,
                node: newNode,
                index: newIndex,
                transitionTime: this.props.transitionTime
            });
        }
        onClick && onClick(e, node.itsa_inside(FOCUSCONTAINER_CLASS)!==container);
    }

    handleFocus(e) {
        let newState, match, focussableNodes;
        const instance = this,
            node = e.target,
            container = instance._domNode;
        newState = {
            hasActiveFocus: (node.itsa_inside(FOCUSCONTAINER_CLASS)===container), // being aware of nested containers
            focussed: node!==container // only set when a descendent has focus
        };
        if (newState.hasActiveFocus) {
            focussableNodes = focusmanager.getFocussableNodes(container, instance.props.selector);
            focussableNodes.some((focussableNode, i) => {
                if (focussableNode.contains(node)) {
                    match = i;
                }
                return (match!==undefined);
            });
            (match!==undefined) && (newState.index=match);
        }
        instance._updatedFromHandleFocus = true;
        // delete async, because we need this value inside `componentDidUpdate`
        // however, because `componentDidUpdate` might not be called (when `state` isn't changed)
        // we will remove this value asyncroniously:
        async(() => delete instance._updatedFromHandleFocus);
        instance.setState(newState);
    }

    isNestedContainer() {
        return !!this.props.keyEnter;
    }

    /**
     * React render-method --> renderes the Component.
     *
     * @method render
     * @return ReactComponent
     * @since 15.0.0
     */
    render() {
        let classname = MAIN_CLASS;
        const instance = this,
            props = instance.props,
            propsClass = props.className,
            state = instance.state;
        propsClass && (classname+=" "+propsClass);
        state.hasActiveFocus && (classname+=" "+MAIN_CLASS_PREFIX+"focussed");
        props.disabled && (classname+=" "+MAIN_CLASS_PREFIX+"disabled");
        props.keyEnter && (classname+=" "+MAIN_CLASS_PREFIX+"nested");
        return (
            <div
                className={classname}
                onBlur={instance.handleBlur}
                onClick={instance.handleClick}
                onFocus={instance.handleFocus}
                onKeyDown={focusmanager.handleKey.bind(null, instance)}
                ref={node => instance._domNode = node}
                style={props.style}
                tabIndex={props.tabIndex} >
                {props.children}
            </div>
        );
    }

    setInitialFocus() {
        let nodes, index, initialFocus;
        const instance = this,
            domNode = instance._domNode,
            props = instance.props,
            initialFocusIndex = props.initialFocusIndex;
        initialFocus = instance.props.initialFocus;
        if (typeof initialFocus==="string") {
            // selector
            nodes = Array.prototype.filter.call(domNode.itsa_getAll(initialFocus), function(node) {
                return (node.itsa_inside(FOCUSCONTAINER_CLASS)===domNode);
            });
            index = (initialFocusIndex==="last") ? nodes.length-1 : initialFocusIndex;
            initialFocus = instance.getFocussableNodes().indexOf(nodes[index]);
        }
        instance.focusElement(initialFocus);
    }

    shouldComponentUpdate(nextProps, nextState) {
        const shouldUpdate = !nextState.noResync;
        delete nextState.noResync;
        return shouldUpdate;
    }

}

Component.propTypes = {
    /**
     * The Component its children
     *
     * @property children
     * @type String || Object || Array
     * @since 15.0.0
    */
    children: PropTypes.oneOfType([PropTypes.string, PropTypes.object, PropTypes.array]),

    /**
     * The classname for the container
     *
     * @property className
     * @type String
     * @since 15.0.0
    */
    className: PropTypes.string,

    /**
     * Whether the focuscontainer is disabled (doesn't response to focusevents)
     *
     * @property disabled
     * @type Boolean
     * @since 15.0.0
    */
    disabled: PropTypes.bool,

    /**
     * Whether a click on the container (outside its elements,
     * should lead into focussing the container
     *
     * @property focusOnContainerClick
     * @default false
     * @type Boolean
     * @since 15.0.10
    */
    focusOnContainerClick: PropTypes.bool,

    /**
     * A `selector` or `index` of the focussable items that should get the initial focus.
     * In case of a selector, it might return multiple nodes: the one that is being used
     * is determined by
     *
     * @property initialFocus
     * @type String|Number
     * @since 15.0.0
    */
    initialFocus: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

    /**
     * In case `initialFocus` is a selector, it might return multiple nodes: the one that is being used.
     * In case of "last", it will return the last node.
     *
     * @property initialFocusIndex
     * @type Number|"last"
     * @default 0
     * @since 15.0.0
    */
    initialFocusIndex: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

    /**
     * What key/keys are responsible for re-focussing `down`. Valid values are charcodes possible prepende with
     * a special key: 9 or `shift+9` or `ctrl+shift+9`. Multiple key combinations can be defined bydefining an array of keyDown-values.
     *
     * @property keyDown
     * @default 9
     * @type String|number|Array
     * @since 15.0.0
    */
    keyDown: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.array]),

    /**
     * Whenever `keyEnter` is set, then the focus-container will become a `nested`- focuscontainer.
     * Nested focuscontainers will automaticcaly become focussable by their parent-container.
     *
     * The `keyEnter` determines what key/keys are responsible for `entering` this container. Valid values are charcodes possible prepende with
     * a special key: 39 or `shift+39` or `ctrl+shift+39`. Multiple key combinations can be defined bydefining an array of keyUp-values.
     *
     * @property keyEnter
     * @type String|number|Array
     * @since 15.0.0
    */
    keyEnter: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.array]),

    /**
     * The `keyLeave` determines what key/keys are responsible for `leaving` this container and go to the parent focus-container.
     * Valid values are charcodes possible prepende with
     * a special key: 39 or `shift+39` or `ctrl+shift+39`. Multiple key combinations can be defined bydefining an array of keyUp-values.
     *
     * @property keyLeave
     * @default 27
     * @type String|number|Array
     * @since 15.0.0
    */
    keyLeave: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.array]),

    /**
     * What key/keys are responsible for re-focussing `up`. Valid values are charcodes possible prepended with
     * a special key: 9 or `shift+9` or `ctrl+shift+9`. Multiple key combinations can be defined bydefining an array of keyUp-values.
     *
     * @property keyUp
     * @default "shift+9"
     * @type String|number|Array
     * @since 15.0.0
    */
    keyUp: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.array]),

    /**
     * Whether the loop the focus when the last/first item is reached.
     *
     * @property loop
     * @default true
     * @type Boolean
     * @since 15.0.0
    */
    loop: PropTypes.bool,

    /**
     * Callback whenever the focuscontainer gets clicked. The callback recieves 2 arguments:
     * e {Object} --> eventobject
     * nested {Boolean} --> whether the click happened inside a nested focus-container
     *
     * @property onClick
     * @type Function
     * @since 0.0.1
    */
    onClick: PropTypes.func,

    /**
     * Callback for when the component did mount.
     *
     * @property onMount
     * @type Function
     * @since 15.0.8
    */
    onMount: PropTypes.func,

    /**
     * Whether to focus on the next item whenever a `enter` is pressed on an input-element.
     *
     * @property refocusOnEnterInput
     * @default true
     * @type Boolean
     * @since 15.0.0
    */
    refocusOnEnterInput: PropTypes.bool,

    /**
     * Whether the focussed item should be scrolled into the view when the focusselector focuses it.
     *
     * @property scrollIntoView
     * @default true
     * @type String
     * @since 15.0.30
    */
    scrollIntoView: PropTypes.bool,

    /**
     * Selector on which the focusmanager should check against when refocussing
     *
     * @property selector
     * @type String
     * @since 15.0.0
    */
    selector: PropTypes.string,

    /**
     * Inline styles for the focus-container
     *
     * @property style
     * @type Object
     * @since 15.0.0
    */
    style: PropTypes.object,

    /**
     * The tabIndex
     *
     * @property tabIndex
     * @type Number
     * @since 0.0.1
    */
    tabIndex: PropTypes.number,

    /**
     * The transition-time when the window needs to be scrolled in order to get the focussable node into the view.
     *
     * @property transitionTime
     * @type Number
     * @since 15.0.0
    */
    transitionTime: PropTypes.number
};

Component.defaultProps = {
    focusOnContainerClick: false,
    initialFocusIndex: 0,
    keyUp: "shift+9", // shift-tab
    keyDown: 9, // tab
    keyLeave: 27, // esc
    loop: true,
    refocusOnEnterInput: true,
    scrollIntoView: false,
    selector: "input, button, select, textarea, [contenteditable=\"true\"], .focusable, [data-focussable=\"true\"]"
};

module.exports = Component;
