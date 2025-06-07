import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  FaShareAlt, FaDownload, FaUniversity, FaGraduationCap, FaStar, FaUser,
  FaPlusCircle, FaBan, FaUsers, FaFileAlt
} from 'react-icons/fa';
import {
  Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input,
  Card, CardBody, CardHeader, CardFooter, Spinner, Alert, Row, Col, CardText, ListGroup, ListGroupItem
} from 'reactstrap';

// ===================================================================================
// 1. VIEW FOR ISSUERS
// ===================================================================================
const UniversityDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true); // Ensure loading is true at the start
      try {
        const response = await apiClient.get('/issuer/dashboard_data');
        console.log(response.data)
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- FIX 1: Handle loading and error states before trying to access `data` ---
  if (isLoading) {
    return <div className="d-flex justify-content-center p-5"><Spinner /></div>;
  }

  if (error) {
    return <Alert color="danger">{error}</Alert>;
  }


  // If we reach here, `data` is guaranteed to exist.
  const stats = [
    { title: 'Credentials Issued', value: data.stats.credentials_issued, icon: <FaFileAlt size={30} />, color: 'primary' },
    { title: 'Active Students', value: data.stats.active_students, icon: <FaUsers size={30} />, color: 'success' },
    { title: 'Revoked Credentials', value: data.stats.revoked_credentials, icon: <FaBan size={30} />, color: 'warning' },
  ];

  return (
    <div>
      <h2 className="mb-4 fw-bold">🏫 University Dashboard</h2>
      <Row className="mb-4">
        {stats.map((stat) => (
          <Col md="4" key={stat.title}>
            <Card className={`text-white bg-${stat.color} shadow`}>
              <CardBody className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fs-1 fw-bold">{stat.value}</div>
                  <div className="fs-6">{stat.title}</div>
                </div>
                {stat.icon}
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>
      <Row>
        <Col lg="4" className="mb-3 mb-lg-0">
          <Card className="h-100 shadow-sm">
            <CardHeader className="fw-bold">Quick Actions</CardHeader>
            <CardBody className="d-flex flex-column justify-content-center">
              <p>Issue a new diploma or certificate</p>
              <Button color="primary" size="lg" onClick={() => navigate('/issuer')}>
                <FaPlusCircle className="me-2" /> Issue New Credential
              </Button>
            </CardBody>
          </Card>
        </Col>
        <Col lg="8">
          <Card className="h-100 shadow-sm">
            <CardHeader className="fw-bold">Recent Activity</CardHeader>
            {data.recent_activity && data.recent_activity.length > 0 ? (
              <ListGroup flush>
                {data.recent_activity.map((activity, index) => (
                  <ListGroupItem key={index}>{activity}</ListGroupItem>
                ))}
              </ListGroup>
            ) : (
              <CardBody>
                <p className="text-muted mb-0">No recent activity found.</p>
              </CardBody>
            )}
          </Card>
        </Col> {/* <-- FIX: Corrected the closing tag from </col> to </Col> */}
      </Row>
    </div>
  );
};

// ===================================================================================
// 2. VIEW FOR HOLDERS / VERIFIERS (AND MODAL)
// ===================================================================================
const DisclosureModal = ({ isOpen, onClose, cred, onGenerate }) => {
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const vcData = cred ? JSON.parse(cred.credential_data) : null;
  const claims = vcData ? Object.keys(vcData.credentialSubject || {}).filter((c) => c !== 'id') : [];

  const handleSubmit = async (event) => {
    event.preventDefault(); setIsGenerating(true); setError('');
    const selectedClaims = Array.from(event.target.elements).filter((el) => el.type === 'checkbox' && el.checked).map((el) => el.name);
    try {
      await onGenerate(cred, selectedClaims);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to generate presentation.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered>
      <ModalHeader toggle={onClose}>Create Verifiable Presentation</ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          <p className="text-muted">Select the claims you wish to reveal.</p>
          {error && <Alert color="danger">{error}</Alert>}
          <div className="my-3">
            {claims.map((claim) => (
              <FormGroup check key={claim} className="mb-2">
                <Input type="checkbox" name={claim} id={`claim-${claim}`} defaultChecked />
                <Label check for={`claim-${claim}`} className="text-capitalize">{claim}</Label>
              </FormGroup>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={onClose}>Cancel</Button>
          <Button color="primary" type="submit" disabled={isGenerating}>
            {isGenerating ? <><Spinner size="sm" /> Generating...</> : 'Generate & Download'}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

const HolderDashboard = () => {
  const [credentials, setCredentials] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCred, setSelectedCred] = useState(null);
  const location = useLocation();
  const alertState = location.state?.alert;

  const fetchCredentials = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/list_credentials');
      setCredentials(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch credentials');
      if (err.response?.status === 401) { logout(); navigate('/login'); }
    } finally {
      setIsLoading(false);
    }
  }, [logout, navigate]);

  useEffect(() => { fetchCredentials(); }, [fetchCredentials]);
  
  const handleGeneratePresentation = async (cred, selectedClaims) => {
    const vcData = JSON.parse(cred.credential_data);
    const disclosureFrame = { "@context": vcData["@context"], type: vcData.type, credentialSubject: { "@explicit": true, id: {}, ...selectedClaims.reduce((acc, claim) => ({...acc, [claim]: {}}), {}) }};
    const response = await apiClient.post('/create_presentation', { cred_id: cred.cred_id, disclosure_frame: disclosureFrame });
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/ld+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `presentation-${cred.cred_id}.jsonld`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenModal = (cred) => { setSelectedCred(cred); setIsModalOpen(true); };
  const handleCloseModal = () => { setSelectedCred(null); setIsModalOpen(false); };

  if (isLoading) {
    return <div className="d-flex justify-content-center p-5"><Spinner /></div>;
  }

  return (
    <>
      {alertState && <Alert color={alertState.color || 'info'} className="mb-4">{alertState.message}</Alert>}
      <h2 className="mb-4 fw-bold">🎓 My Credentials</h2>
      {error && <Alert color="danger">{error}</Alert>}
      {credentials.length === 0 ? (
        <Alert color="info">You do not have any credentials yet.</Alert>
      ) : (
        <Row xs="1" md="2" className="g-4">
          {credentials.map((cred) => {
            const vcData = JSON.parse(cred.credential_data);
            const { credentialSubject: subject = {}, type = [] } = vcData;
            const vcType = type.find((t) => t !== 'VerifiableCredential') || 'Credential';
            return (
              <Col key={cred.cred_id}>
                <Card className="h-100 shadow-sm border-light-subtle">
                  <CardHeader className="fw-bold bg-light">{vcType}</CardHeader>
                  <CardBody>
                    <CardText><FaUser className="me-2 text-muted" /><strong>Name:</strong> {subject.name || 'N/A'}</CardText>
                    <CardText><FaUniversity className="me-2 text-muted" /><strong>University:</strong> {subject.university || 'N/A'}</CardText>
                    <CardText><FaGraduationCap className="me-2 text-muted" /><strong>Course:</strong> {subject.course || 'N/A'}</CardText>
                    <CardText><FaStar className="me-2 text-muted" /><strong>Grade:</strong> {subject.grade || 'N/A'}</CardText>
                  </CardBody>
                  <CardFooter className="d-flex justify-content-between align-items-center bg-light">
                    <small className="text-muted">Issued: {new Date(cred.issued_at).toLocaleDateString()}</small>
                    <div>
                      <Button color="primary" size="sm" className="me-2" onClick={() => handleOpenModal(cred)}><FaShareAlt className="me-1" /> Create Presentation</Button>
                      <Button color="secondary" size="sm" onClick={() => { /* Download logic */ }}><FaDownload className="me-1" /> Download</Button>
                    </div>
                  </CardFooter>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
      <DisclosureModal isOpen={isModalOpen} onClose={handleCloseModal} cred={selectedCred} onGenerate={handleGeneratePresentation} />
    </>
  );
};

// ===================================================================================
// 3. MAIN EXPORTED COMPONENT (THE "ROUTER")
// ===================================================================================
const Dashboard = () => {
  const { user } = useAuth();

  // This is the core logic: based on the user's role, render the correct dashboard view.
  if (user.role === 'issuer') {
    return <UniversityDashboard />;
  } else {
    // For any other role (e.g., 'verifier', 'holder'), show the personal credential list.
    return <HolderDashboard />;
  }
};

export default Dashboard;