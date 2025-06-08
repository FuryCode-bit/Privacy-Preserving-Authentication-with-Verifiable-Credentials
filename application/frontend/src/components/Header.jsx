import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Navbar, NavbarBrand, Nav, Dropdown, DropdownToggle, DropdownMenu, DropdownItem
} from 'reactstrap';
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
        {user && (
          <Dropdown isOpen={dropdownOpen} toggle={toggle}>
            <DropdownToggle caret color="dark">
              <FaUserCircle className="me-2" />
              {user.email}
            </DropdownToggle>

            <DropdownMenu end>
              <DropdownItem onClick={() => navigate('/dashboard')}>
                <FaTachometerAlt className="me-2" />
                My Dashboard
              </DropdownItem>

              {user.role === 'issuer' && (
                <DropdownItem onClick={() => navigate('/issuer')}>
                  <FaScroll className="me-2" />
                  Issuer Portal
                </DropdownItem>
              )}

              <DropdownItem onClick={() => navigate('/verifier')}>
                <FaSearch className="me-2" />
                Verifier Portal
              </DropdownItem>
              
              <DropdownItem divider />
              
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