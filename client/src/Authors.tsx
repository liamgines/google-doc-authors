import { useState, useEffect } from "react";

function AuthorsList(permissionIdAuthors) {
    let paragraphs = [];
    for (const permissionId in permissionIdAuthors) {
        const author = permissionIdAuthors[permissionId];
        paragraphs.push(<p>{author.displayName} {author.emailAddress ? `(${author.emailAddress})` : ""} | {author.totalChars} characters | {author.contributionPercentage}%</p>);
    }
    return paragraphs;
}

export default function Authors() {
    const [permissionIdAuthors, setPermissionIdAuthors] = useState(null);

    async function fetchPermissionIdAuthors() {
        try {
            const response = await fetch("/api/authors");
            if (!response.ok) return console.error("Error: Failed to fetch authors");

            const permissionIdAuthors = await response.json();
            setPermissionIdAuthors(permissionIdAuthors);
        }
        catch (error) {
            console.error("Error:", error);
        }
    }

    useEffect(() => {
        fetchPermissionIdAuthors();
    }, []);

    if (!permissionIdAuthors) return (<p>Retrieving authors...</p>);
    return (<>
        {AuthorsList(permissionIdAuthors)}
    </>);
}
