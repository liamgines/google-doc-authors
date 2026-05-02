import { useState } from "react";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router";
import GoogleAuthorization from "./GoogleAuthorization";
import GoogleLogout from "./GoogleLogout";
import GoogleDocsList from "./GoogleDocsList";
import GoogleDocQuotes from "./GoogleDocQuotes";

const clientUser = await (await fetch("/api/authorize/user-with-google-drive-access")).json();

function VisitorOnlyRoute({ user }) {
    const visitor = !user;
    if (visitor) return <Outlet />;
    return (<Navigate to="/" replace />);
}

function UserOnlyRoute({ user, setUser }) {
    if (user) return (<><GoogleLogout setUser={setUser} /><Outlet /></>);
    return (<Navigate to="/login" replace />);
}

function App() {
    const [user, setUser] = useState(clientUser);

    return (
        <BrowserRouter>
        <Routes>
           <Route element={<VisitorOnlyRoute user={user} />}>
               <Route path="/login" element={<GoogleAuthorization setUser={setUser} />} />
           </Route>

           <Route element={<UserOnlyRoute user={user} setUser={setUser} />}>
                <Route index element={<GoogleDocsList user={user} setUser={setUser} />} />
                <Route path="/docId/:id" element={<GoogleDocQuotes />} />
           </Route>
        </Routes>
        </BrowserRouter>
    );
}

export default App;
