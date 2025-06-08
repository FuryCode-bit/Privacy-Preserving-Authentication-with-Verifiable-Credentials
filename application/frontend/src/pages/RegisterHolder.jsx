import React, { useState } from 'react';
import {
  Container, Row, Col, Card, CardBody, CardHeader, Form, FormGroup, Label, Input,
  Button, Spinner, Alert, InputGroup, InputGroupText
} from 'reactstrap';
import { FaEnvelope, FaLock, FaUserPlus } from 'react-icons/fa';
import apiClient from '../api/apiClient';

const RegisterHolder = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        email,
        password,
        role: 'holder'
      };
      const response = await apiClient.post('/register', payload);
      setSuccess(response.data.message || 'Holder registered successfully!');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Row className="justify-content-center">
      <Col md="8" lg="6">
        <Card className="shadow-sm">
          <CardHeader className="fw-bold fs-5">
            <FaUserPlus className="me-2" />
            Register New Holder
          </CardHeader>
          <CardBody className="p-4">
            <p className="text-muted">Create a new student or holder account. They will be able to log in with these credentials to manage their VCs.</p>
            <hr />
            <Form onSubmit={handleSubmit}>
              {error && <Alert color="danger">{error}</Alert>}
              {success && <Alert color="success">{success}</Alert>}

              <FormGroup className="mb-3">
                <Label for="email">Holder's Email</Label>
                <InputGroup>
                  <InputGroupText><FaEnvelope /></InputGroupText>
                  <Input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" required disabled={isLoading} />
                </InputGroup>
              </FormGroup>

              <FormGroup className="mb-3">
                <Label for="password">Password</Label>
                <InputGroup>
                  <InputGroupText><FaLock /></InputGroupText>
                  <Input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required disabled={isLoading} />
                </InputGroup>
              </FormGroup>
              
              <FormGroup className="mb-4">
                <Label for="confirmPassword">Confirm Password</Label>
                <InputGroup>
                  <InputGroupText><FaLock /></InputGroupText>
                  <Input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required disabled={isLoading} />
                </InputGroup>
              </FormGroup>

              <Button color="primary" block disabled={isLoading} size="lg">
                {isLoading ? <><Spinner size="sm" /> Registering...</> : 'Register Holder'}
              </Button>
            </Form>
          </CardBody>
        </Card>
      </Col>
    </Row>
  );
};

export default RegisterHolder;