import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  FaShareAlt, FaDownload, FaUniversity, FaGraduationCap, FaStar, FaUser,
  FaPlusCircle, FaBan, FaUsers, FaFileAlt, FaUserPlus
} from 'react-icons/fa';
import {
  Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input,
  Card, CardBody, CardHeader, CardFooter, Spinner, Alert, Row, Col, CardText, ListGroup, ListGroupItem
} from 'reactstrap';

import { InputGroup, InputGroupText, Pagination, PaginationItem, PaginationLink } from 'reactstrap';
import { FaSearch } from 'react-icons/fa';

const UniversityDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true); 
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

  if (isLoading) {
    return <div className="d-flex justify-content-center p-5"><Spinner /></div>;
  }

  if (error) {
    return <Alert color="danger">{error}</Alert>;
  }


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
        {/* This column now uses flexbox to manage its children */}
        <Col lg="4" className="d-flex flex-column mb-3 mb-lg-0">
          {/* Card for Issuing Credentials */}
          <Card className="shadow-sm mb-4"> {/* Removed h-50, added margin-bottom */}
            <CardHeader className="fw-bold">Credential Management</CardHeader>
            <CardBody className="d-flex flex-column justify-content-center">
              <p>Issue a new diploma or certificate.</p>
              <Button color="primary" size="lg" onClick={() => navigate('/issuer')}>
                <FaPlusCircle className="me-2" /> Issue New Credential
              </Button>
            </CardBody>
          </Card>

          {/* Card for User Management */}
          <Card className="shadow-sm"> {/* Removed h-50 and mt-4 */}
            <CardHeader className="fw-bold">User Management</CardHeader>
            <CardBody className="d-flex flex-column justify-content-center">
              <p>Create a new account for a student or VC holder.</p>
              <Button color="success" size="lg" onClick={() => navigate('/register-holder')}>
                <FaUserPlus className="me-2" /> Register New Holder
              </Button>
            </CardBody>
          </Card>
        </Col>
        <Col lg="8" className="d-flex flex-column">
          <Card className="h-150 shadow-sm">
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

const HolderDashboard = () => {
  const [allCredentials, setAllCredentials] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const alertState = location.state?.alert;

  const fetchCredentials = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/holder/list_credentials');
      setAllCredentials(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch credentials');
      if (err.response?.status === 401) { logout(); navigate('/login'); }
    } finally {
      setIsLoading(false);
    }
  }, [logout, navigate]);

  useEffect(() => { fetchCredentials(); }, [fetchCredentials]);
  
  const handleDownload = (docWrapper) => {
    try {
      const documentJson = JSON.parse(docWrapper.credential_data);
      const blob = new Blob([JSON.stringify(documentJson, null, 2)], { type: 'application/ld+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const category = docWrapper.category || 'document';
      a.href = url;
      a.download = `${category.toLowerCase()}-${docWrapper.cred_id}.jsonld`;
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error("Download failed:", err);
      setError("Failed to prepare document for download.");
    }
  };

  const filteredCredentials = useMemo(() => {
    if (!searchTerm) {
      return allCredentials;
    }
    return allCredentials.filter(docWrapper => {
      try {
        const doc = JSON.parse(docWrapper.credential_data);
        const category = docWrapper.category || 'VC';
        let title = '';
        if (category === 'VP') {
          const vcsInVp = Array.isArray(doc.verifiableCredential) ? doc.verifiableCredential : [];
          if (vcsInVp.length > 0) {
            const firstVc = vcsInVp[0];
            title = firstVc.type.filter(t => t !== 'VerifiableCredential').pop() || 'Credential';
          }
        } else {
          title = doc.type.find(t => t !== 'VerifiableCredential') || 'Credential';
        }
        return title.toLowerCase().includes(searchTerm.toLowerCase());
      } catch (e) {
        return false;
      }
    });
  }, [allCredentials, searchTerm]);

  const pageCount = Math.ceil(filteredCredentials.length / ITEMS_PER_PAGE);
  const paginatedCredentials = filteredCredentials.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  
  const handlePageClick = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  if (isLoading) {
    return <div className="d-flex justify-content-center p-5"><Spinner /></div>;
  }

  return (
    <>
      {alertState && <Alert color={alertState.color || 'info'} className="mb-4">{alertState.message}</Alert>}
      
      {/* --- CORRECTED HEADER LAYOUT --- */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0 fw-bold">🎓 My Stored Documents</h2>
        <div style={{ width: '300px' }}>
          <InputGroup>
            <InputGroupText><FaSearch /></InputGroupText>
            <Input 
              type="text" 
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </InputGroup>
        </div>
      </div>
      {/* --- END OF HEADER LAYOUT --- */}

      {error && <Alert color="danger">{error}</Alert>}

      {allCredentials.length === 0 ? (
        <Alert color="info">You do not have any credentials or presentations stored yet.</Alert>
      ) : (
        <> {/* This fragment correctly wraps the conditional content */}
          <Row xs="1" md="2" lg="3" className="g-4">
            {paginatedCredentials.map((docWrapper) => {
              const documentData = JSON.parse(docWrapper.credential_data);
              const category = docWrapper.category || 'VC';
              let cardHeaderClass, cardTitle, cardContent;

              if (category === 'VP') {
                cardHeaderClass = 'bg-success-subtle text-success-emphasis';
                const vcsInVp = Array.isArray(documentData.verifiableCredential) ? documentData.verifiableCredential : [];
                
                cardTitle = vcsInVp.length > 0
                  ? `Presentation: ${vcsInVp[0].type.filter(t => t !== 'VerifiableCredential').pop() || 'Credential'}`
                  : 'Verifiable Presentation';
                
                cardContent = (
                  <>
                    <p>This presentation contains <strong>{vcsInVp.length}</strong> credential(s).</p>
                    {vcsInVp.length > 0 && <hr />}
                    {vcsInVp.map((vc, index) => {
                      const subject = vc.credentialSubject || {};
                      const vcType = vc.type.filter(t => t !== 'VerifiableCredential').pop() || 'Credential';
                      return (
                        <div key={index} className="p-2 mb-2 bg-light rounded border">
                          <h6 className="fw-bold mb-1">{vcType}</h6>
                          {Object.entries(subject)
                            .filter(([key]) => key !== 'id')
                            .map(([key, value]) => (
                              <small key={key} className="d-block text-capitalize">
                                <strong>{key}:</strong> {String(value)}
                              </small>
                            ))
                          }
                        </div>
                      )
                    })}
                  </>
                );
              } else {
                cardHeaderClass = 'bg-primary-subtle text-primary-emphasis';
                cardTitle = documentData.type.find(t => t !== 'VerifiableCredential') || 'Credential';
                const subject = documentData.credentialSubject || {};
                cardContent = (
                  <>
                    <CardText><FaUser className="me-2 text-muted" /><strong>Name:</strong> {subject.name || 'N/A'}</CardText>
                    <CardText><FaUniversity className="me-2 text-muted" /><strong>University:</strong> {subject.university || 'N/A'}</CardText>
                    <CardText><FaGraduationCap className="me-2 text-muted" /><strong>Course:</strong> {subject.course || 'N/A'}</CardText>
                    <CardText><FaStar className="me-2 text-muted" /><strong>Grade:</strong> {subject.grade || 'N/A'}</CardText>
                  </>
                );
              }

              return (
                <Col key={docWrapper.cred_id}>
                  <Card className="h-100 shadow-sm border-light-subtle">
                    <CardHeader className={`fw-bold ${cardHeaderClass}`}>
                      <span className={`badge me-2 bg-${category === 'VP' ? 'success' : 'primary'}`}>{category}</span>
                      {cardTitle}
                    </CardHeader>
                    <CardBody>{cardContent}</CardBody>
                    <CardFooter className="d-flex justify-content-between align-items-center bg-light">
                      <small className="text-muted">Stored: {new Date(docWrapper.issued_at).toLocaleDateString()}</small>
                      <Button color="secondary" size="sm" onClick={() => handleDownload(docWrapper)}>
                        <FaDownload className="me-1" /> Download
                      </Button>
                    </CardFooter>
                  </Card>
                </Col>
              );
            })}
          </Row>

          {paginatedCredentials.length === 0 && searchTerm && (
            <Alert color="warning" className="mt-4">No documents found matching "{searchTerm}".</Alert>
          )}

          {pageCount > 1 && (
            <div className="d-flex justify-content-center mt-4">
              <Pagination>
                {/* PaginationItems no longer need any special classes */}
                <PaginationItem disabled={currentPage <= 1}>
                  <PaginationLink previous onClick={() => handlePageClick(currentPage - 1)} />
                </PaginationItem>
                {[...Array(pageCount)].map((_, i) => (
                  <PaginationItem active={i + 1 === currentPage} key={i}>
                    <PaginationLink onClick={() => handlePageClick(i + 1)}>
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem disabled={currentPage >= pageCount}>
                  <PaginationLink next onClick={() => handlePageClick(currentPage + 1)} />
                </PaginationItem>
              </Pagination>
            </div>
          )}
        </>
      )}
    </>
  );
};

const Dashboard = () => {
  const { user } = useAuth();

  if (user.role === 'issuer') {
    return <UniversityDashboard />;
  } else {
    return <HolderDashboard />;
  }
};

export default Dashboard;