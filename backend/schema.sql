-- Drop tables if they exist
DROP TABLE IF EXISTS Revocations;
DROP TABLE IF EXISTS Credentials;
DROP TABLE IF EXISTS Dids;
DROP TABLE IF EXISTS Users;

-- Create Users table
CREATE TABLE Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Should store a hash of the password
    private_key TEXT,
    role TEXT
);

-- Create Credentials table
CREATE TABLE Credentials (
    cred_id INTEGER PRIMARY KEY AUTOINCREMENT,
    issuer_id INTEGER NOT NULL,
    holder_id INTEGER NOT NULL,
    credential_hash TEXT NOT NULL,
    type TEXT,
    status TEXT DEFAULT 'active',
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(issuer_id) REFERENCES Users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY(holder_id) REFERENCES Users(user_id) ON DELETE RESTRICT
);

-- Create Revocations table
CREATE TABLE Revocations (
    revoc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cred_id INTEGER UNIQUE NOT NULL,
    revoked_id INTEGER,
    revocation_issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(cred_id) REFERENCES Credentials(cred_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS TokenBlocklist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    jti VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    INDEX (expires_at) -- Add an index to easily clean up old tokens
);

-- Indexes (SQLite does not support IF NOT EXISTS in CREATE INDEX)
CREATE INDEX idx_dids_user_id ON Dids(user_id);
CREATE INDEX idx_credentials_issuer_id ON Credentials(issuer_id);
CREATE INDEX idx_credentials_holder_id ON Credentials(holder_id);
CREATE INDEX idx_credentials_status ON Credentials(status);
CREATE INDEX idx_revocations_cred_id ON Revocations(cred_id);

-- Insert test data into Users
INSERT INTO Users (username, email, password, public_key, role) VALUES
('UA', 'marco.bernardes@ua.pt', 'd12969696a163a445b6658578392d7e9024ae053f797963b3f6cbad74acf0b7a', 
'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuwej1NcleQhJOBq3tQQQ 14hjPE/RKE2EGgj/H3GrLbPqYQgw+aEaa0tA82qxrihB+g1UR7RzDFnoNQI/TvMA WX1Rr0AaU0kFRgnaC1nHuAXIog9LBfor5vdj/8cW77pig3N/9zH467W+QrKgvCm6 VTrMdopeFn8RZLCBOjJ2VpsvD3G09qxuji8KlwAT1W1cCoXxoSyG49wtfQ8lN0GM FM3jjAMm/119LSo6pM1p/pEzfTp6cN8LRunMW6deA7mtWUAIqc8FxPESCUA1fb+N gUZOrPNHKWEPzoYFNDAOgRsQlEwe9pZDvghVH+tLLLtbDHkgH8i8+6ZpIQFx92n2 zwIDAQAB', 'issuer'),
('Fury', 'macobenades5@protonmail.com', '2ed85cf71a479c06aed5950b6cece3deb18a3d246212e64ac9d5527b140d7595',
'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiraJ8pEa2/ayEaC1Hr+Z IRCAGeQ/qJvfOTGqUy8J5vrtxRPOwKLxQGZcrud7gkXcJFwX1Bu1LtnEZBdKOpNw kZZB/mnKrpshdR5Ymbfum/4v7tWflSMkU5j2xtqRUVOVpl4qOk0IIR34bGHQ82J7 ZcvFM32rVR5GF6+msyYPH/Zdga5h7tsfIYIdizhmkDBYrnWRCPkNtTS1gaI2tSPm 52OEBFMZirk552N+mZsEpYDJUdeCKBPcjHXjy5KUKbk4VqhsN2PBvGhKhVXzt+HM dv8dpgK8X/LbFjMDEHAMa6noLZbel9Y1nEwiq5V/daZc1KYU+awz6XN7GUMEqUvD HQIDAQAB', 'holder');

-- Insert test data into Dids
INSERT INTO Dids (user_id, did) VALUES
((SELECT user_id FROM Users WHERE email = 'marco.bernardes@ua.pt'), 'did:example:marco.bernardes@ua.pt'),
((SELECT user_id FROM Users WHERE email = 'macobenades5@protonmail.com'), 'did:example:macobenades5@proton.com');