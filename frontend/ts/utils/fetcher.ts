const fetchWithoutCache = (
    url: string,
) => {
    return fetch(
        url,
        {cache: "no-store"},
    )
}

export { fetchWithoutCache }
