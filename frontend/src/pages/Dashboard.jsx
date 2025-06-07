import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

// Import reactstrap components
import {
  Container,
  Row,
  Col,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  Label,
  Input,
  Card,
  CardBody,
  CardTitle,
  CardText,
  CardHeader,
  Spinner,
  Alert
} from 'reactstrap';

// --- Disclosure Modal Component (Refactored with reactstrap and Hooks fixed) ---
const DisclosureModal = ({ isOpen, onClose, cred, onGenerate }) => {
  // --- FIX: Hooks are now at the top level, before any conditions ---
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // The modal will not render its content unless `isOpen` is true,
  // so the check for `cred` can happen inside the JSX.
  const vcData = cred ? JSON.parse(cred.credential_data) : null;
  const claims = vcData ? Object.keys(vcData.credentialSubject || {}).filter(c => c !== 'id') : [];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsGenerating(true);
    setError('');

    const selectedClaims = Array.from(event.target.elements)
      .filter(el => el.type === 'checkbox' && el.checked)
      .map(el => el.name);
      
    try {
      await onGenerate(cred, selectedClaims);
      onClose(); // Close the modal on success
    } catch (err) {
      setError(err.message || "Failed to generate presentation.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    // Use reactstrap's Modal component
    <Modal isOpen={isOpen} toggle={onClose} centered>
      <ModalHeader toggle={onClose}>Create Presentation</ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          <p>Select the claims you want to reveal from this credential.</p>
          {error && <Alert color="danger">{error}</Alert>}
          <div className="my-3">
            {claims.map(claim => (
              <FormGroup check key={claim}>
                <Input type="checkbox" name={claim} id={`claim-${claim}`} defaultChecked />
                <Label check for={`claim-${claim}`}>
                  {claim}
                </Label>
              </FormGroup>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button color="primary" type="submit" disabled={isGenerating}>
            {isGenerating ? <><Spinner size="sm" /> Generating...</> : 'Generate & Download'}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};


// --- Main Dashboard Component (Refactored with reactstrap) ---
const Dashboard = () => {
  const [credentials, setCredentials] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCred, setSelectedCred] = useState(null);

  const fetchCredentials = useCallback(async () => {
    try {
      const response = await apiClient.get('/list_credentials');
      setCredentials(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch credentials');
      if (err.response?.status === 401) {
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  }, [logout, navigate]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleOpenModal = (cred) => {
    setSelectedCred(cred);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedCred(null);
    setIsModalOpen(false);
  };
  
  const handleGeneratePresentation = async (cred, selectedClaims) => {
    // This logic remains the same
    const vcData = JSON.parse(cred.credential_data);
    const disclosureFrame = {
        "@context": vcData["@context"],
        type: vcData.type,
        credentialSubject: {
            "@explicit": true,
            id: {},
            ...selectedClaims.reduce((acc, claim) => ({...acc, [claim]: {}}), {})
        }
    };
    
    const response = await apiClient.post('/create_presentation', {
        cred_id: cred.cred_id,
        disclosure_frame: disclosureFrame
    });
    
    const presentation = response.data;
    const blob = new Blob([JSON.stringify(presentation, null, 2)], { type: 'application/ld+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presentation-${cred.cred_id}-${Date.now()}.jsonld`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner color="primary" style={{ width: '3rem', height: '3rem' }}>Loading...</Spinner>
      </div>
    );
  }

  return (
    <Container className="py-4">
      <Row className="mb-4 align-items-center">
        <Col>
          <h1 className="mb-0">Welcome, {user?.email}</h1>
        </Col>
        <Col className="text-end">
          <Button color="danger" onClick={() => { logout(); navigate('/login'); }}>
            Logout
          </Button>
        </Col>
      </Row>

      <h2 className="mb-3">🎓 My Credentials</h2>
      {error && <Alert color="danger">{error}</Alert>}
      
      {credentials.length === 0 && !isLoading ? (
        <p>No credentials found.</p>
      ) : (
        credentials.map((cred) => {
          const vcData = JSON.parse(cred.credential_data);
          const { credentialSubject: subject = {}, type = [] } = vcData;
          const vcType = type.find(t => t !== 'VerifiableCredential') || 'Credential';
          return (
            <Card key={cred.cred_id} className="mb-3">
              <CardHeader tag="h5" className="bg-light">
                {vcType}
              </CardHeader>
              <CardBody>
                <Row>
                  <Col sm="6"><CardText><strong>Name:</strong> {subject.name || 'N/A'}</CardText></Col>
                  <Col sm="6"><CardText><strong>University:</strong> {subject.university || 'N/A'}</CardText></Col>
                  <Col sm="6"><CardText><strong>Course:</strong> {subject.course || 'N/A'}</CardText></Col>
                  <Col sm="6"><CardText><strong>Grade:</strong> {subject.grade || 'N/A'}</CardText></Col>
                </Row>
                <hr />
                <div className="d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    <strong>Issued:</strong> {new Date(cred.issued_at).toLocaleDateString()}
                  </small>
                  <div>
                    <Button color="primary" size="sm" className="me-2" onClick={() => handleOpenModal(cred)}>
                      Create Presentation
                    </Button>
                    <Button color="secondary" size="sm" onClick={() => { /* Download logic */ }}>
                      Download Full VC
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })
      )}
      
      <DisclosureModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        cred={selectedCred} 
        onGenerate={handleGeneratePresentation} 
      />
    </Container>
  );
};

export default Dashboard;