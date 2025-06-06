# Notes: 

## Next steps:

 * Revoke VCs

 * ZKP

 * Blockchain to store means of verifieing issuers and revok VCs


## Website

VC Issuer: Implement a service that can issue VCs based on (simulated or, if accessible, real) eIDAS-aligned electronic identification. This may involve also simulating a Qualified Trust Service Provider (QTSP) for issuing electronic identity credentials. 

VC Holder (User): Develop a component (e.g., a browser extension, mobile app or web application) that can store and manage VCs. 

VC Verifier (Service Provider): Implement a service that can verify VCs presented by the user. It may grant access to a system, or simply present the result of the validation. 

Authentication Flow: Implement the complete authentication flow, from VC issuance to verification and authorization. 

Privacy Enhancements: Explore and implement privacy-enhancing techniques, such as selective disclosure (allowing users to share only necessary attributes) or, if time permits, investigate the use of zero-knowledge proofs for attribute verification.
