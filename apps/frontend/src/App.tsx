import "./App.css";
import { useUser } from "./hooks/useUser";
import supabase from "./lib/supabaseClient";
import axios from "axios";
function App() {
  const { claims } = useUser();
  return (
    <div>
      {!claims && (
        <button
          onClick={async () => {
            await supabase.auth.signInWithWeb3({
              chain: "solana",
              statement: "I confirm i want to signIN in  prediction market",
            });
          }}
        >
          SignIN with Solana
        </button>
      )}

      {claims && (
        <button
          onClick={async () => {
            await supabase.auth.signOut();
          }}
        >
          LogOut
        </button>
      )}

      {JSON.stringify(claims)}

      <button
        onClick={async () => {
          await supabase.auth.getSession().then((r) => {
            console.log(r.data.session.access_token);
            axios.post(
              "http://localhost:3000/buy",
              {},
              {
                headers: {
                  Authorization: r.data.session.access_token,
                },
              },
            );
          });
        }}
      >
        BUY
      </button>
    </div>
  );
}

export default App;
