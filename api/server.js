const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const {
  getUserByEmail,
  createUser,
  updateUserCounter,
  getUserById,
} = require("./db");

const app = express();
app.use(express.json());
app.use(cookieParser());

const CLIENT_URL = "http://localhost:5173";
const RP_ID = "localhost";

app.use(cors({ origin: CLIENT_URL, credentials: true }));

app.get("/init-register", async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await getUserByEmail(email);
    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }

    const options = await generateRegistrationOptions({
      rpID: RP_ID,
      rpName: "Web Dev Simplified",
      userName: email,
    });

    res.cookie(
      "regInfo",
      JSON.stringify({
        userId: options.user.id,
        email,
        challenge: options.challenge,
      }),
      { httpOnly: true, maxAge: 60000, secure: true }
    );

    res.json(options);
  } catch (error) {
    console.error("Error in /init-register:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/verify-register", async (req, res) => {
  const regInfo = JSON.parse(req.cookies.regInfo);

  if (!regInfo) {
    return res.status(400).json({ error: "Registration info not found" });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: regInfo.challenge,
      expectedOrigin: CLIENT_URL,
      expectedRPID: RP_ID,
    });

    if (verification.verified) {
      await createUser(regInfo.userId, regInfo.email, {
        id: verification.registrationInfo.credentialID,
        publicKey: verification.registrationInfo.credentialPublicKey,
        counter: verification.registrationInfo.counter,
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        transport: req.body.transports,
      });
      res.clearCookie("regInfo");
      return res.json({ verified: verification.verified });
    } else {
      return res
        .status(400)
        .json({ verified: false, error: "Verification failed" });
    }
  } catch (error) {
    console.error("Error in /verify-register:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/init-auth", async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "No user for this email" });
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: [
        {
          id: user.passkey_id,
          type: "public-key",
          transports: user.passkey_transports,
        },
      ],
    });

    res.cookie(
      "authInfo",
      JSON.stringify({
        userId: user.id,
        challenge: options.challenge,
      }),
      { httpOnly: true, maxAge: 60000, secure: true }
    );

    res.json(options);
  } catch (error) {
    console.error("Error in /init-auth:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/verify-auth", async (req, res) => {
  const authInfo = JSON.parse(req.cookies.authInfo);

  if (!authInfo) {
    return res.status(400).json({ error: "Authentication info not found" });
  }

  try {
    const user = await getUserById(authInfo.userId);
    if (!user || user.passkey_id !== req.body.id) {
      return res.status(400).json({ error: "Invalid user" });
    }

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: authInfo.challenge,
      expectedOrigin: CLIENT_URL,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: user.passkey_id,
        credentialPublicKey: user.passkey_public_key,
        counter: user.passkey_counter,
        transports: user.passkey_transports,
      },
    });

    if (verification.verified) {
      await updateUserCounter(user.id, verification.authenticationInfo.newCounter);
      res.clearCookie("authInfo");
      return res.json({ verified: verification.verified });
    } else {
      return res
        .status(400)
        .json({ verified: false, error: "Verification failed" });
    }
  } catch (error) {
    console.error("Error in /verify-auth:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
