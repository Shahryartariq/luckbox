import React from 'react'

import '../../node_modules/bootstrap/dist/css/bootstrap.min.css';

const Buttons = (props) => {
    const ClickHandler = (e) =>{
        console.log('E: ', e.target.id);
        props.DataValue(e.target.id);

    }
    return (
        <div>
            <button className="btn btn-primary myButton" id={props.val} onClick={ClickHandler}>Guess {props.val}</button>
        </div>
    )
}

export default Buttons
