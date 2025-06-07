CREATE DATABASE IF NOT EXISTS projetoVC;

-- Use the database
USE projetoVC;

-- Drop tables if they exist to ensure a clean slate
DROP TABLE IF EXISTS projetoVC.Revocations;
DROP TABLE IF EXISTS projetoVC.Credentials;
DROP TABLE IF EXISTS projetoVC.Users;

-- Create Users table
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) UNIQUE,                 
    email VARCHAR(255) UNIQUE NOT NULL,           
    password VARCHAR(255) NOT NULL,               
    private_key TEXT,                             
    role VARCHAR(50)                             
);

-- Create Credentials table
CREATE TABLE Credentials (
    cred_id INT PRIMARY KEY AUTO_INCREMENT,
    issuer_id INT NOT NULL,
    holder_id INT NOT NULL,
    credential_hash VARCHAR(255) NOT NULL,        
    credential_data TEXT NOT NULL,
    type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',          
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(issuer_id) REFERENCES Users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY(holder_id) REFERENCES Users(user_id) ON DELETE RESTRICT
);

-- Create Revocations table
CREATE TABLE Revocations (
    revoc_id INT PRIMARY KEY AUTO_INCREMENT,
    cred_id INT UNIQUE NOT NULL,
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Renamed for clarity from 'revocation_issued_at'
    -- 'revoked_id' was in your original, but its purpose isn't clear without context.
    -- If it's the ID of the user/entity performing the revocation, it might be:
    -- revoker_user_id INT,
    -- FOREIGN KEY(revoker_user_id) REFERENCES Users(user_id),
    FOREIGN KEY(cred_id) REFERENCES Credentials(cred_id) ON DELETE CASCADE
);

-- Indexes (MariaDB supports IF NOT EXISTS, but can be omitted if problematic for your version)
CREATE INDEX IF NOT EXISTS idx_users_email ON Users(email); -- Good to index email for lookups
CREATE INDEX IF NOT EXISTS idx_credentials_issuer_id ON Credentials(issuer_id);
CREATE INDEX IF NOT EXISTS idx_credentials_holder_id ON Credentials(holder_id);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON Credentials(status);
CREATE INDEX IF NOT EXISTS idx_revocations_cred_id ON Revocations(cred_id);
