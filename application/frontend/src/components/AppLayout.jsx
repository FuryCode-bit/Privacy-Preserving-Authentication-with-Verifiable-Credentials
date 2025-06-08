import React from 'react';
import Header from './Header';
import { Container } from 'reactstrap';

const AppLayout = ({ children }) => {
  const styles = `
    .app-layout {
      min-height: 100vh;
      background-color: #f4f7f9; // A light, clean grey
      background-image:
        radial-gradient(circle at 1px 1px, #d1d5db 1px, transparent 0);
      background-size: 25px 25px;
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="app-layout">
        <Header />
        <Container className="py-4 py-md-5">
          {children}
        </Container>
      </div>
    </>
  );
};

export default AppLayout;