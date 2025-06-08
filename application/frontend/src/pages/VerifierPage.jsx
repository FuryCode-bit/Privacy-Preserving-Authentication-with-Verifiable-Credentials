import React, { useState } from 'react';
import {
  Card, CardBody, CardHeader, Form, FormGroup, Label, Input, Button, Spinner, Alert, Col, Row
} from 'reactstrap';
import { FaCheckCircle, FaTimesCircle, FaUpload, FaSearch } from 'react-icons/fa';
import apiClient from '../api/apiClient';

const VerifierPage = () => {
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setResult(null); setError(''); setIsLoading(true);

    try {
      const fileContent = await file.text();
      const payload = JSON.parse(fileContent);
      
      const response = await apiClient.post('verifier/verify', payload);
      setResult(response.data);
    } catch (err) {
      const message = err.response?.data?.message || "Verification failed or file is invalid.";
      setError(message);
      setResult({ verified: false });
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetForm = () => {
    setResult(null); setError(''); setFileName(''); setFileInputKey(Date.now());
  };

  return (
    <Row className="justify-content-center">
      <Col md="8" lg="7">
        <Card className="shadow-sm border-light-subtle">
          <CardHeader className="fw-bold fs-5"><FaSearch className="me-2" />Verifier Portal</CardHeader>
          <CardBody className="p-4">
            <Form>
              <FormGroup>
                <Label for="file-upload" className="btn btn-outline-primary w-100">
                  <FaUpload className="me-2" />{fileName ? `Selected: ${fileName}` : 'Select a VC/VP JSON File'}
                </Label>
                <Input id="file-upload" key={fileInputKey} type="file" accept=".json,.jsonld" onChange={handleFileUpload} hidden />
              </FormGroup>
              {isLoading && <div className="text-center my-3"><Spinner /> <p>Verifying...</p></div>}
              {!isLoading && result !== null && (
                <Alert color={result.verified ? 'success' : 'danger'} className="mt-4 d-flex align-items-center">
                  {result.verified ? <FaCheckCircle size={24} className="me-3" /> : <FaTimesCircle size={24} className="me-3" />}
                  <div>
                    <h5 className="alert-heading">{result.verified ? 'Verification Successful' : 'Verification Failed'}</h5>
                    {error && <p className="mb-0">{error}</p>}
                  </div>
                </Alert>
              )}
              {(result || error) && <Button color="secondary" onClick={resetForm} className="mt-3">Verify Another</Button>}
            </Form>
          </CardBody>
        </Card>
      </Col>
    </Row>
  );
};

export default VerifierPage;