[![Build Status](https://travis-ci.org/ItsAsbreuk/itsa-react-focuscontainer.svg?branch=master)](https://travis-ci.org/ItsAsbreuk/itsa-react-focuscontainer)

Sorry, this module is not yet documented and tested.
It does work though! So you can use its powerfull features.

The focuscontainer adds a wrapper over items that should be focussable by keyboard movement.

Look at the the file `lib/component.jsx` for the properties to use.

## Features:
* Adds keyboard focussing
* Focus stays inside the container
* Specify which keys trigger the focus
* Specify which element should be focussed (even non-focussable elements)
* Focussed elements outside the view get inside through transition
* Life: keeps on doing its job when descendant React-Components change
* Container gets labelled with a class `itsa-focuscontainer-focussed` when descendant element has focus
* Works with nested focus-containers

## How to use:

```js
const React = require("react"),
    ReactDOM = require("react-dom"),
    FocusContainer = require("itsa-react-focuscontainer");

ReactDOM.render(
    <FocusContainer transitionTime={300} >
        <input type="text" />
        <input type="text" />
        <input type="text" />
        <button>Press me</button>
    </FocusContainer>,
    document.getElementById("component-container")
);

```

Or nested:

```css
.itsa-focuscontainer:focus {
    border-style: dotted;
}
```

```js
const React = require("react"),
    ReactDOM = require("react-dom"),
    FocusContainer = require("itsa-react-focuscontainer");

ReactDOM.render(
    <FocusContainer transitionTime={300} >
        <input type="text" />
        <input type="text" />
        <input type="text" />
        <FocusContainer
            keyEnter={13}
            transitionTime={300} >
            <input type="text" />
            <input type="text" />
            <input type="text" />
        </FocusContainer>,
        <button>Press me</button>
    </FocusContainer>,
    document.getElementById("component-container")
);

```
