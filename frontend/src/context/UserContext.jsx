import { createContext, useContext, useEffect, useState } from "react";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  async function fetchCurrentUser() {
    // TODO: replace with real API call once backend auth exists:
    // const res = await fetch("/api/users/me");
    // const data = await res.json();

    // Simulated network delay + response shape
    const data = await new Promise((resolve) =>
      setTimeout(() => {
        resolve({
          id: "temp-user-1",
          name: "Kelvin",
          streak: 5,
          friendsOnline: 3,
        });
      }, 300)
    );

    setUser(data);
    setLoading(false);
  }

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}