function GoogleLogout({ setUser }) {
    async function logout() {
        const serverResponse = await fetch("/api/authorize/logout");
        if (!serverResponse.ok) return console.error("Google sign out failed");

        setUser(null);
    }

    return (<button onClick={logout}>Logout</button>);
}

export default GoogleLogout;
