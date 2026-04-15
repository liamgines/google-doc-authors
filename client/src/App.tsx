import { useState } from 'react'
import './App.css'


function App() {
    let [message, setMessage] = useState("");
    return (
    <>
        <p>{message}</p>
        <button onClick={() => {
            fetch("/api")
            .then(res => res.json())
            .then(json => json.message)
            .then(serverMessage => setMessage(message => serverMessage))
            .catch(error => console.error())
        }}>Send Request</button>
    </>
    )
}

export default App
