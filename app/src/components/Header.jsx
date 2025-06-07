import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Navbar, NavbarBrand, Nav, Dropdown, DropdownToggle, DropdownMenu, DropdownItem
} from 'reactstrap';
// Import new icons for a slicker look
import {
  FaUserCircle, FaSignOutAlt, FaTachometerAlt, FaScroll, FaSearch
} from 'react-icons/fa';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggle = () => setDropdownOpen((prevState) => !prevState);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Navbar color="dark" dark expand="md" className="px-3 shadow-sm">
      <NavbarBrand href="/" className="fw-bold">
        🎓 VC Diploma Portal
      </NavbarBrand>
      <Nav className="ms-auto" navbar>
        {/* Only render the dropdown if a user is logged in */}
        {user && (
          <Dropdown isOpen={dropdownOpen} toggle={toggle}>
            <DropdownToggle caret color="dark">
              <FaUserCircle className="me-2" />
              {user.email}
            </DropdownToggle>

            <DropdownMenu end>
              {/* This item is visible to all logged-in users */}
              <DropdownItem onClick={() => navigate('/dashboard')}>
                <FaTachometerAlt className="me-2" />
                My Dashboard
              </DropdownItem>

              {/* --- THIS IS THE CRITICAL CHANGE --- */}
              {/* Conditionally render the "Issuer Portal" link */}
              {user.role === 'issuer' && (
                <DropdownItem onClick={() => navigate('/issuer')}>
                  <FaScroll className="me-2" />
                  Issuer Portal
                </DropdownItem>
              )}
              {/* ------------------------------------ */}
              
              {/* This item is visible to all logged-in users */}
              <DropdownItem onClick={() => navigate('/verifier')}>
                <FaSearch className="me-2" />
                Verifier Portal
              </DropdownItem>
              
              <DropdownItem divider />
              
              {/* This item is visible to all logged-in users */}
              <DropdownItem onClick={handleLogout}>
                <FaSignOutAlt className="me-2" />
                Logout
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
      </Nav>
    </Navbar>
  );
};

export default Header;