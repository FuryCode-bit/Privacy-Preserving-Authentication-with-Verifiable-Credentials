import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  Container, Row, Col, Card, CardBody, CardHeader, Form, FormGroup, Label, Input,
  Button, Spinner, Alert, InputGroup, InputGroupText
} from 'reactstrap';
import { FaLock, FaEnvelope } from 'react-icons/fa';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiClient.post('/login', { email, password });
      if (response.data.token && response.data.user) {
        login(response.data.user, response.data.token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const styles = `
    .login-container {
      min-height: 100vh;
      background-color: #f8f9fa;
      background-image:
        radial-gradient(circle at 1px 1px, #d1d5db 1px, transparent 0),
        radial-gradient(circle at 10px 10px, #d1d5db 1px, transparent 0);
      background-size: 20px 20px;
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <Container fluid className="login-container d-flex align-items-center justify-content-center">
        <Row>
          <Col md="12">
            <Card className="shadow-lg" style={{ width: '24rem' }}>
              <CardHeader className="text-center bg-primary text-white">
                <h2 className="mb-0">VC Diploma Portal Login</h2>
              </CardHeader>
              <CardBody className="p-4">
                <Form onSubmit={handleLogin}>
                  {error && <Alert color="danger">{error}</Alert>}
                  <FormGroup className="mb-3">
                    <Label for="email">Email</Label>
                    <InputGroup>
                      <InputGroupText><FaEnvelope /></InputGroupText>
                      <Input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required disabled={isLoading} />
                    </InputGroup>
                  </FormGroup>
                  <FormGroup className="mb-4">
                    <Label for="password">Password</Label>
                    <InputGroup>
                      <InputGroupText><FaLock /></InputGroupText>
                      <Input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required disabled={isLoading} />
                    </InputGroup>
                  </FormGroup>
                  <Button color="primary" block disabled={isLoading} size="lg">
                    {isLoading ? <><Spinner size="sm" /> Logging In...</> : 'Login'}
                  </Button>
                </Form>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default Login;