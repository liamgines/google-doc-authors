import { useState } from "react";
import { BrowserRouter, Routes, Route, Outlet, Navigate, Link } from "react-router";
import GoogleAuthorization from "./GoogleAuthorization";
import GoogleLogout from "./GoogleLogout";
import GoogleDocsList from "./GoogleDocsList";
import GoogleDocQuotes from "./GoogleDocQuotes";
import Authors from "./Authors";

const clientUser = await (await fetch("/api/authorize/user-with-google-drive-access")).json();

function VisitorOnlyRoute({ user }) {
    const visitor = !user;
    if (visitor) return <Outlet />;
    return (<Navigate to="/" replace />);
}

function UserOnlyRoute({ user, setUser }) {
    if (user) return (<>
    <Link to="/authors">Authors</Link>
    <GoogleLogout setUser={setUser} />
    <Outlet />
    </>);
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
                <Route path="/authors" element={<Authors />} />
           </Route>
        </Routes>
        </BrowserRouter>
    );
}

export default App;
