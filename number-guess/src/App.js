import React, { useState } from "react";
import Title from "./Components/Title";
import Buttons from "./Components/Buttons";

import "../node_modules/bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

let random = 0 + Math.random() * (9 - 0);
random = Math.floor(random);

function App() {
  const [inputValue, setInputValue] = useState("");
  let startCount = 5;
  const [count, setCount] = useState(startCount);

  let arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  const InputValue = (val) => {
    console.log("Input Value", val);
    setInputValue(val);
    setCount((oldvalue) => {
      return oldvalue - 1;
    });
  };

  const ReloadHandler = () => {
    document.location.reload();
  };

  let winFlag = false;

  return (
    <>
      <Title />
      <div className="textAreaContainer">
        <input
          type="text"
          placeholder="Enter Guess Using Buttons"
          value={inputValue}
          onChange={InputValue}
          disabled
          className="shadow-lg"
          autoComplete="off"
        />
      </div>
      <div className="btnContainer">
        {arr.map((val, index) => {
          return <Buttons key={index} val={val} DataValue={InputValue} />;
        })}
      </div>

      {count > 0 ? (
        <div>
          {inputValue != "" ? (
            <div>
              {inputValue == random ? (
                <div>
                  <button className="btn btn-success-outline myButton myAttempts">
                    Attempts left {count}
                  </button>
                  <h1 className="mainHeading text-success">
                    You are a Winner <br />
                    <button
                      className="btn btn-success myButton myAttempts"
                      onClick={ReloadHandler}
                    >
                      Reload
                    </button>
                  </h1>
                </div>
              ) : (
                <div>
                  <button className="btn btn-success-outline myButton myAttempts">
                    Attempts left {count}
                  </button>
                  <h1 className="mainHeading text-danger">
                    You Lose Try Againn
                  </h1>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div>
          <h1 className="mainHeading text-danger">Attempts Over You Lost</h1>{" "}
          <button
            className="btn btn-success myButton myAttempts"
            onClick={ReloadHandler}
          >
            Reload
          </button>{" "}
        </div>
      )}
    </>
  );
}

export default App;
