<!-- Project Privacy-Preserving-Authentication-with-Verifiable-Credentials: https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials -->
<a name="readme-top"></a>

[![Contributors][contributors-shield]][contributors-url]
[![Stargazers][stars-shield]][stars-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials">
    <img src="readme/ua.png" alt="Logo" height="80">
  </a>

  <h3 align="center">Privacy Preserving Authentication with Verifiable Credentials</h3>

  <p align="center"> A new way of authentication 
    <br />
    <a href="https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <!-- <a href="https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials">View Demo</a> -->
    ·
    <a href="https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials/issues">Report Bug</a>
    <!-- ·
    <a href="https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials/issues">Request Feature</a> -->
  </p>
</div>

<!-- ABOUT THE PROJECT -->
## About The Project

![Product Name Screen Shot][project-screenshot]

### Overview

As administrative and academic processes increasingly transition to digital platforms, the authentication and validation of qualifications, certifications, and professional achievements have become complex challenges. This project proposes an innovative system for issuing tamper-proof digital diplomas using Verifiable Credentials (VCs), aligned with the eIDAS 2.0 regulation.

The primary goal of this project is to enable academic institutions to issue secure, verifiable digital diplomas, streamlining the verification process for employers—without requiring direct contact with the issuing body. Users gain full control over their digital credentials, backed by privacy-preserving mechanisms like Selective Disclosure, ensuring both flexibility and robust fraud protection.

## Background

Traditional credential verification methods are slow, centralized, and vulnerable to tampering. In contrast, our solution leverages verifiable credentials and Decentralized Identifiers (DIDs) to create a decentralized, user-controlled system. By using Verifiable Presentations (VPs), users can disclose only the information necessary—protecting privacy while maintaining trust.

This architecture is scalable and adaptable, supporting various digital attestations beyond diplomas, such as licenses, memberships, and other professional certifications.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

### Execution

#### Backend

```shell
cd application/backend
python3 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt

# Setup Database
python3  app/utils/seed_users.py
```
#### Frontend

```shell
cd application/frontend
npm install
```

#### Extension (VC-Wallet)

```bash
cd vc-wallet-extension
npm install --global web-ext
web-ext run --devtools
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- Issues -->
## Issues

See the [open issues](https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials/issues) for a full list of proposed features (and known issues).

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->

[contributors-shield]: https://img.shields.io/github/contributors/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials.svg?style=for-the-badge
[contributors-url]: https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials.svg?style=for-the-badge
[forks-url]: https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials/network/members
[stars-shield]: https://img.shields.io/github/stars/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials.svg?style=for-the-badge
[stars-url]: https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials/stargazers
[issues-shield]: https://img.shields.io/github/issues/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials.svg?style=for-the-badge
[issues-url]: https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials/issues
[license-shield]: https://img.shields.io/github/license/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials.svg?style=for-the-badge
[license-url]: https://github.com/FuryCode-bit/Privacy-Preserving-Authentication-with-Verifiable-Credentials/blob/master/LICENSE

[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/bernardeswebdev

[project-screenshot]: readme/vcs.png