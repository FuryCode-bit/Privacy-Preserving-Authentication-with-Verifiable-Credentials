import React, { useState } from 'react';
import apiClient from '../api/apiClient';
import {
  Card, CardBody, CardHeader, Form, FormGroup, Label, Input, Button, Spinner, Alert,
  InputGroup, InputGroupText, Col, Row
} from 'reactstrap';
import { FaUser, FaEnvelope, FaGraduationCap, FaStar, FaCalendarAlt, FaPaperPlane, FaDownload } from 'react-icons/fa';

const IssuerPortal = () => {
  const [form, setForm] = useState({ name: '', holderEmail: '', degree: '', grade: '', date: '' });
  const [vc, setVc] = useState(null);
  const [error, setError] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleIssue = async (e) => {
    e.preventDefault();
    setError('');
    setIsIssuing(true);
    setVc(null);
    try {
      const payload = { name: form.name, holder_email: form.holderEmail, course: form.degree, grade: form.grade, completionDate: form.date };
      const response = await apiClient.post('/issue_vc', payload);
      setVc(response.data);
      setForm({ name: '', holderEmail: '', degree: '', grade: '', date: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to issue credential.');
    } finally {
      setIsIssuing(false);
    }
  };
  
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(vc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'verifiable-credential.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Row className="justify-content-center">
      <Col md="10" lg="8">
        <Card className="shadow-sm border-light-subtle">
          <CardHeader className="fw-bold fs-5"><FaPaperPlane className="me-2" />Issue New Credential</CardHeader>
          <CardBody className="p-4">
            <Form onSubmit={handleIssue}>
              {error && <Alert color="danger">{error}</Alert>}
              {vc && <Alert color="success">Credential Issued Successfully!</Alert>}
              <Row>
                <Col md="6"><FormGroup><Label for="name">Recipient's Name</Label><InputGroup><InputGroupText><FaUser /></InputGroupText><Input id="name" name="name" value={form.name} onChange={handleChange} required /></InputGroup></FormGroup></Col>
                <Col md="6"><FormGroup><Label for="holderEmail">Holder's Email</Label><InputGroup><InputGroupText><FaEnvelope /></InputGroupText><Input id="holderEmail" name="holderEmail" type="email" value={form.holderEmail} onChange={handleChange} required /></InputGroup></FormGroup></Col>
                <Col md="6"><FormGroup><Label for="degree">Degree Title</Label><InputGroup><InputGroupText><FaGraduationCap /></InputGroupText><Input id="degree" name="degree" value={form.degree} onChange={handleChange} required /></InputGroup></FormGroup></Col>
                <Col md="6"><FormGroup><Label for="grade">Grade</Label><InputGroup><InputGroupText><FaStar /></InputGroupText><Input id="grade" name="grade" value={form.grade} onChange={handleChange} required /></InputGroup></FormGroup></Col>
                <Col md="6"><FormGroup><Label for="date">Completion Date</Label><InputGroup><InputGroupText><FaCalendarAlt /></InputGroupText><Input id="date" name="date" type="date" value={form.date} onChange={handleChange} required /></InputGroup></FormGroup></Col>
              </Row>
              <hr />
              <div className="d-flex justify-content-end">
                {vc && <Button color="success" onClick={handleDownload} className="me-2"><FaDownload className="me-2" />Download VC</Button>}
                <Button color="primary" type="submit" disabled={isIssuing}>
                  {isIssuing ? <><Spinner size="sm" /> Issuing...</> : "Issue Credential"}
                </Button>
              </div>
            </Form>
          </CardBody>
        </Card>
      </Col>
    </Row>
  );
};

export default IssuerPortal;