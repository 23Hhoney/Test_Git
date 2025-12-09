import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Badge,
    ListGroup,
    Table,
    ListGroupItem,
    Spinner,
    Row,
    Col,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from 'reactstrap';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaDownload, FaPaperclip } from 'react-icons/fa';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import BreadCrumbs from '../../layouts/breadcrumbs/BreadCrumbs';
import ComponentCard from '../../components/ComponentCard';
import FileUploadService from '../../services/FileUploadService';
import RqfService from '../../services/RfqService';
import { getEntityId } from '../localStorageUtil';
import '../CompanyManagement/ReactBootstrapTable.scss';
import SupplierService from '../../services/SupplierService';
import AddressService from '../../services/AddressService';
import LocationService from '../../services/LocationService';
import DepartmentService from '../../services/DepartmentService';
import ClassService from '../../services/ClassService';
import GLAccountService from '../../services/GLaccountService';
import ProjectService from '../../services/ProjectService';
import RfqSupplierModal from './RfqSupplierModal';
import { RFQ_STATUS, RFQ_SUPPLIER_STATUS } from '../../constant/RfqConstant';
import aiIcon from '../../assets/images/ai-insight.png.jpeg';

const RFQDetail = () => {
    const { rfqId } = useParams();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const isFromDashboard = params.get('dashboard') === 'true';
    const companyId = getEntityId();
    const [rfqData, setRfqData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [suppliersWithDetails, setSuppliersWithDetails] = useState([]);
    const [shipToAddressName, setShipToAddressName] = useState('');
    const [locationName, setLocationName] = useState('');
    const [departmentName, setDepartmentName] = useState('');
    const [className, setClassName] = useState('');
    const [glAccountName, setGlAccountName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [showSupplierDialog, setShowSupplierDialog] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [showApproversModal, setShowApproversModal] = useState(false);
    const [newSupplier, setNewSupplier] = useState({
        name: '',
        email: '',
        phone: '',
    });
    const [showAIRecommendationModal, setShowAIRecommendationModal] = useState(false);
    const [aiRecommendation, setAiRecommendation] = useState(null);
    const [loadingRecommendation, setLoadingRecommendation] = useState(false);
    const navigate = useNavigate();

    const fetchAllSuppliers = async () => {
        try {
            const response = await SupplierService.getAllSupplier(companyId);
            setSuppliers(response.data);
        } catch (err) {
            toast.error('Failed to fetch suppliers');
        }
    };
    const addExistingSupplier = async (supplierId) => {
        try {
            console.log('Inviting supplier with ID:', supplierId);
            await RqfService.inviteSupplier(companyId, rfqId, supplierId.supplierId);
            toast.success('Supplier added successfully');
            const res = await RqfService.getRfqById(companyId, rfqId);
            const rfq = res.data;
            const supplierDetails = await Promise.all(
                rfq.suppliers.map(async (supplier) => {
                    try {
                        const detail = await SupplierService.getSupplierById(supplier.supplierId);
                        return {
                            ...supplier,
                            name: detail.data[0].name,
                            email: detail.data[0].email,
                            primaryContact: detail.data[0].primaryContact,
                        };
                    } catch (e) {
                        return {
                            ...supplier,
                            name: '',
                            email: '',
                        };
                    }
                }),
            );
            setSuppliersWithDetails(supplierDetails);
            setShowSupplierDialog(false);
        } catch (err) {
            toast.error('Failed to add supplier');
        }
    };

    const addNewSupplier = async () => {
        try {
            const supplierResponse = await SupplierService.createSupplier(companyId, {
                name: newSupplier.name,
                email: newSupplier.email,
                primaryContact: newSupplier.phone,
            });

            await RqfService.addSupplierToRfq(companyId, rfqId, supplierResponse.data.supplierId);
            toast.success('New supplier added and invited to RFQ');

            const res = await RqfService.getRfqById(companyId, rfqId);
            const rfq = res.data;
            const supplierDetails = await Promise.all(
                rfq.suppliers.map(async (supplier) => {
                    try {
                        const detail = await SupplierService.getSupplierById(supplier.supplierId);
                        return {
                            ...supplier,
                            name: detail.data[0].name,
                            email: detail.data[0].email,
                            primaryContact: detail.data[0].primaryContact,
                        };
                    } catch (e) {
                        return {
                            ...supplier,
                            name: '',
                            email: '',
                        };
                    }
                }),
            );
            setSuppliersWithDetails(supplierDetails);
            setShowSupplierDialog(false);
            setNewSupplier({ name: '', email: '', phone: '' });
        } catch (err) {
            toast.error('Failed to add new supplier');
        }
    };

    const handleDownload = async (fileId) => {
        try {
            const response = await FileUploadService.getFileByFileId(fileId);
            const contentDisposition = response.headers['content-disposition'];
            let filename = `file_${fileId}`;

            if (contentDisposition) {
                const [, extractedFilename] = contentDisposition.match(/filename="?(.+)"?/) || [];
                if (extractedFilename) {
                    filename = extractedFilename;
                }
            }

            const contentType = response.headers['content-type'];
            const [, extension] = contentType?.split('/') || [];
            if (!filename.includes('.') && extension) {
                filename = `${filename}.${extension}`;
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to download file');
            console.error('Download error:', error);
        }
    };

    useEffect(() => {
        const fetchRFQDetail = async () => {
            try {
                const response = await RqfService.getRfqById(companyId, rfqId);
                const rfq = response.data;
                setRfqData(rfq);
                if (rfq.shipToAddressId) {
                    AddressService.getAddressById(companyId, rfq.shipToAddressId)
                        .then((res) => {
                            const addr = res.data;
                            const formattedAddress = [addr.addressLine1, addr.city, addr.country, addr.postalCode]
                                .filter(Boolean)
                                .join(', ');
                            setShipToAddressName(formattedAddress);
                        })
                        .catch(() => setShipToAddressName(''));
                }

                if (rfq.locationId) {
                    LocationService.getLocationById(companyId, rfq.locationId)
                        .then((res) => setLocationName(res.data[0]?.name || ''))
                        .catch(() => setLocationName(''));
                }

                if (rfq.departmentId) {
                    DepartmentService.getByIdDepartment(companyId, rfq.departmentId)
                        .then((res) => setDepartmentName(res.data[0]?.name || ''))
                        .catch(() => setDepartmentName(''));
                }

                if (rfq.classId) {
                    ClassService.getByIdClass(companyId, rfq.classId)
                        .then((res) => setClassName(res.data[0]?.name || ''))
                        .catch(() => setClassName(''));
                }

                if (rfq.glAccountId) {
                    GLAccountService.getGlAccountById(companyId, rfq.glAccountId)
                        .then((res) => setGlAccountName(res.data[0]?.name || ''))
                        .catch(() => setGlAccountName(''));
                }

                if (rfq.projectId) {
                    ProjectService.getProjectByProjectId(companyId, rfq.projectId)
                        .then((res) => setProjectName(res.data[0]?.name || ''))
                        .catch(() => setProjectName(''));
                }
            } catch (err) {
                setError('Failed to fetch RFQ details.');
            } finally {
                setLoading(false);
            }
        };
        fetchRFQDetail();
        fetchAllSuppliers();
    }, [rfqId]);

    useEffect(() => {
        const fetchRfqAndSuppliers = async () => {
            try {
                const res = await RqfService.getRfqById(companyId, rfqId);
                const rfq = res.data;
                const supplierDetails = await Promise.all(
                    rfq.suppliers.map(async (supplier) => {
                        try {
                            const detail = await SupplierService.getSupplierById(supplier.supplierId);
                            return {
                                ...supplier,
                                name: detail.data[0].name,
                                email: detail.data[0].email,
                                primaryContact: detail.data[0].primaryContact,
                            };
                        } catch (e) {
                            return {
                                ...supplier,
                                name: '',
                                email: '',
                            };
                        }
                    }),
                );

                setRfqData(rfq);
                setSuppliersWithDetails(supplierDetails);
            } catch (err) {
                setError('Failed to fetch RFQ or suppliers');
            } finally {
                setLoading(false);
            }
        };

        fetchRfqAndSuppliers();
    }, [rfqId]);

    const getStatusBadge = (status) => {
        const colors = {
            submitted: 'primary',
            created: 'warning',
            cancelled: 'danger',
            completed: 'success',
            supplier_shortlisted: 'info',
        };
        const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
        return (
            <Badge color={colors[status] || 'dark'} pill>
                {label}
            </Badge>
        );
    };

    const getSupplierStatusBadge = (status) => {
        const colors = {
            submitted: 'primary',
            negotiation: 'warning',
            finalized: 'success',
            rejected: 'danger',
            cancelled: 'danger',
            signoff_requested: 'info',
        };
        const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
        return (
            <Badge color={colors[status] || 'dark'} pill>
                {label}
            </Badge>
        );
    };

    const handleAIRecommendationClick = async () => {
        setLoadingRecommendation(true);
        const supplierIds = suppliersWithDetails.map((supplier) => supplier.supplierId);

        try {
            const response = await RqfService.getSupplierByAIRecommendation(supplierIds);

            const recommendedSupplier = suppliersWithDetails.find(
                (supplier) => supplier.supplierId === response.data.recommendedSupplierId,
            );

            setAiRecommendation({
                ...response.data,
                supplierName: recommendedSupplier?.name || 'Unknown Supplier',
            });
            setShowAIRecommendationModal(true);
        } catch (err) {
            const errorMessage =
                err?.response?.data?.errorMessage ||
                err?.response?.errorMessage ||
                'Something went wrong. Please try again.';
            toast.error(errorMessage);
        } finally {
            setLoadingRecommendation(false);
        }
    };

    const formatDate = (date) => {
        try {
            return format(new Date(date), 'MMM dd, yyyy');
        } catch (e) {
            return 'Invalid date';
        }
    };

    const formatDateTime = (date) => {
        try {
            return format(new Date(date), 'MMM dd, yyyy h:mm a');
        } catch (e) {
            return 'Invalid date';
        }
    };

    const getFullName = (user) => {
        return user ? `${user.firstName} ${user.lastName}` : 'Unknown';
    };

    const handleEnterSupplierResponse = () => {
        if (rfqId && rfqData.rfqStatus !== RFQ_STATUS.CREATED) {
            navigate(`/rfqSupplierResponse/${rfqId}`);
        }
    };

    const handleSendToSuppliers = async () => {
        try {
            await RqfService.sendRfqToSupplier(companyId, rfqId);
            toast.success('RFQ sent to suppliers');
            setTimeout(() => {
                navigate('/rfq');
            }, 2000);
        } catch (err) {
            toast.error('Failed to send RFQ');
        }
    };

    if (loading)
        return (
            <div className="text-center py-5">
                <Spinner />
            </div>
        );
    if (error) return <div className="text-danger text-center py-5">{error}</div>;
    if (!rfqData) return <div className="text-center py-5">No RFQ found.</div>;

    const allowedStatuses = ['signoff_requested', 'supplier_shortlisted', 'finalized', 'completed'];

    const hasSignoffRequested = suppliersWithDetails.some((s) =>
        allowedStatuses.includes(s.supplierStatus?.toLowerCase()),
    );

    const requestedSupplier = hasSignoffRequested
        ? suppliersWithDetails.find((s) => allowedStatuses.includes(s.supplierStatus?.toLowerCase()))
        : null;

    return (
        <>
            <ToastContainer
                position="top-right"
                autoClose={2000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover={false}
                style={{ top: '12px', right: '12px' }}
                toastStyle={{
                    marginBottom: '0',
                    position: 'absolute',
                    top: 0,
                    right: 0,
                }}
            />
            <BreadCrumbs />
            <ComponentCard
                className="mb-2"
                title={
                    <div className="d-flex justify-content-between align-items-center">
                        <span>RFQ Detail: {rfqData.title}</span>
                        {rfqData.attachments?.length > 0 && (
                            <div className="d-flex align-items-center">
                                <span className="me-2 small">Attachments:</span>
                                {rfqData.attachments.map((att) => (
                                    <Button
                                        key={att.attachmentId}
                                        color="link"
                                        onClick={() => handleDownload(att.fileId)}
                                        className="p-0 ms-1"
                                        title={`File #${att.fileId}`}
                                    >
                                        <FaDownload size={16} />
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                }
            >
                <CardBody className="rfqDetail">
                    <div className="row">
                        <div className="col-lg-6">
                            <Card style={{ marginBottom: '0px' }}>
                                <CardHeader>
                                    <div className="d-flex justify-content-between align-items-center w-100">
                                        <CardTitle style={{ marginBottom: 0 }}>
                                            Basic Info & Timeline
                                        </CardTitle>
                                        <Col md="auto" className="d-flex align-items-center">
                                            <strong className="me-2">Status:</strong>
                                            {getStatusBadge(rfqData.rfqStatus)}
                                        </Col>
                                    </div>
                                </CardHeader>
                                <CardBody style={{ padding: '0px !important' }}>
                                    <ListGroup flush>
                                        <ListGroupItem>
                                            <strong>Title:</strong> {rfqData.title}
                                        </ListGroupItem>
                                        <ListGroupItem>
                                            <strong>Objective:</strong> {rfqData.objective}
                                        </ListGroupItem>
                                        <ListGroupItem>
                                            <strong>Requirements:</strong> {rfqData.requirements}
                                        </ListGroupItem>
                                        <ListGroupItem>
                                            <Row className="align-items-center">
                                                <Col md="4" className="d-flex align-items-center" style={{ width: '30%' }}>
                                                    <strong className="me-2">Purchase Type:</strong>{' '}
                                                    {rfqData.purchseType}
                                                </Col>
                                                {hasSignoffRequested && requestedSupplier && (
                                                    <>
                                                        <Col
                                                            md="5"
                                                            className="d-flex align-items-center"
                                                            style={{ width: '45%' }}
                                                        >
                                                            <strong className="me-2">SignOff Requested for:</strong>
                                                            {requestedSupplier.name}
                                                        </Col>
                                                        <Col md="3" className="text-end">
                                                            <Button
                                                                color="link"
                                                                size="sm"
                                                                className="shadow-none p-0"
                                                                onClick={() => setShowApproversModal(true)}
                                                            >
                                                                View Approvers
                                                            </Button>
                                                        </Col>
                                                    </>
                                                )}
                                            </Row>
                                        </ListGroupItem>

                                        <ListGroupItem>
                                            <div className="row">
                                                <div className="col-md-4 col-sm-12" style={{ width: '24%' }}>
                                                    <div className="text-muted small">Required By</div>
                                                    <div>{formatDate(rfqData.requiredAt)}</div>
                                                </div>

                                                <div className="col-md-4 col-sm-12" style={{ width: '42%' }}>
                                                    <div className="text-muted small">Created</div>
                                                    <div>
                                                        {formatDate(rfqData.createdDate)} by {getFullName(rfqData.createdBy)}
                                                    </div>
                                                </div>
                                                {rfqData.rfqStatus !== RFQ_STATUS.CREATED && (
                                                    <div className="col-md-4 col-sm-12">
                                                        <div className="text-muted small">Submitted At</div>
                                                        <div>{formatDateTime(rfqData.submittedAt)}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </ListGroupItem>
                                    </ListGroup>
                                </CardBody>
                            </Card>
                        </div>

                        <div className="col-lg-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle style={{ marginBottom: '0px' }}>Organization & Financials</CardTitle>
                                </CardHeader>
                                <CardBody style={{ padding: '5px' }}>
                                    <ListGroup flush>
                                        {shipToAddressName && (
                                            <ListGroupItem>
                                                <strong>Ship To Address:</strong> {shipToAddressName}
                                            </ListGroupItem>
                                        )}
                                        {projectName && (
                                            <ListGroupItem>
                                                <strong>Project:</strong> {projectName}
                                            </ListGroupItem>
                                        )}
                                        {locationName && (
                                            <ListGroupItem>
                                                <strong>Location:</strong> {locationName}
                                            </ListGroupItem>
                                        )}
                                        {glAccountName && (
                                            <ListGroupItem>
                                                <strong>GL Account:</strong> {glAccountName}
                                            </ListGroupItem>
                                        )}
                                        {departmentName && (
                                            <ListGroupItem>
                                                <strong>Department:</strong> {departmentName}
                                            </ListGroupItem>
                                        )}
                                        {className && (
                                            <ListGroupItem>
                                                <strong>Class:</strong> {className}
                                            </ListGroupItem>
                                        )}
                                    </ListGroup>
                                </CardBody>
                            </Card>
                        </div>
                    </div>

                    <div className="mb-2">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <h5>Items ({rfqData.rfqItems?.length})</h5>
                        </div>
                        <div className="table-responsive">
                            <Table striped>
                                <thead>
                                    <tr>
                                        <th>Part ID</th>
                                        <th>Description</th>
                                        <th>Qty</th>
                                        <th>UOM</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rfqData.rfqItems?.map((item) => (
                                        <tr key={item.rfqItemId}>
                                            <td>{item.partId}</td>
                                            <td>{item.description}</td>
                                            <td>{item.quantity}</td>
                                            <td>{item.uom}</td>
                                            <td>{item.notes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <div className="d-flex align-items-center gap-2">
                                <h5 className="mb-0">Suppliers ({suppliersWithDetails.length})</h5>
                                <div
                                    className="text-primary text-decoration-underline cursor-pointer small"
                                    onClick={handleAIRecommendationClick}
                                    style={{ fontSize: '11px' }}
                                    disabled={loadingRecommendation}
                                >
                                    {loadingRecommendation ? (
                                        <>
                                            <img
                                                className="me-1 mb-2"
                                                width="18"
                                                height="18"
                                                src={aiIcon}
                                                alt="sparkling"
                                            />
                                            <Spinner size="sm" className="me-1 mt-1" />
                                        </>
                                    ) : (
                                        <>
                                            <img
                                                className="me-1 mb-1"
                                                width="18"
                                                height="18"
                                                src={aiIcon}
                                                alt="sparkling"
                                            />
                                            AI Insights
                                        </>
                                    )}
                                </div>
                            </div>
                            {!suppliersWithDetails.some(
                                (s) =>
                                    s.supplierStatus === RFQ_SUPPLIER_STATUS.SIGNOFF_REQUESTED ||
                                    s.supplierStatus === RFQ_SUPPLIER_STATUS.FINALIZED,
                            ) && (
                                    <Button color="primary" size="sm" onClick={() => setShowSupplierDialog(true)}>
                                        Invite Supplier
                                    </Button>
                                )}
                        </div>
                        <div className="table-responsive">
                            <Table striped>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th>Attachment</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliersWithDetails.map((s) => (
                                        <tr key={s.rfqSupplierId}>
                                            <td>{s.name}</td>
                                            <td>{s.email}</td>
                                            <td>{s.primaryContact || ''}</td>
                                            <td>
                                                {s.attachments?.length ? (
                                                    <ul className="list-unstyled mb-0">
                                                        {s.attachments.map((a) => (
                                                            <li key={a.attachmentId} className="d-flex align-items-center gap-1">
                                                                <FaPaperclip />
                                                                File #{a.fileId}
                                                                <Button
                                                                    color="link"
                                                                    size="sm"
                                                                    onClick={() => handleDownload(a.fileId)}
                                                                    className="p-0 ms-2"
                                                                >
                                                                    <FaDownload size={14} />
                                                                </Button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span className="small text-muted">No files</span>
                                                )}
                                            </td>
                                            <td>{getSupplierStatusBadge(s.supplierStatus)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                    <div className="d-flex justify-content-end gap-2">
                        <Button color="secondary" onClick={() => navigate(isFromDashboard ? '/dashboard' : '/rfq')}>
                            Back
                        </Button>
                        {!suppliersWithDetails.some(
                            (s) =>
                                s.supplierStatus === RFQ_SUPPLIER_STATUS.SIGNOFF_REQUESTED ||
                                s.supplierStatus === RFQ_SUPPLIER_STATUS.FINALIZED,
                        ) && (
                                <Button
                                    color="success"
                                    onClick={handleSendToSuppliers}
                                    disabled={rfqData.rfqStatus !== RFQ_STATUS.CREATED}
                                >
                                    Send to Suppliers
                                </Button>
                            )}
                        {rfqData.rfqStatus !== RFQ_STATUS.CREATED && (
                            <Button color="primary" onClick={handleEnterSupplierResponse}>
                                View Quotation
                            </Button>
                        )}
                    </div>
                </CardBody>
                <Modal
                    isOpen={showAIRecommendationModal}
                    toggle={() => {
                        setShowAIRecommendationModal(false);
                        setAiRecommendation(null);
                    }}
                    centered
                    className="ai-recommendation-modal"
                >
                    <ModalHeader
                        toggle={() => {
                            setShowAIRecommendationModal(false);
                            setAiRecommendation(null);
                        }}
                    >
                        AI Insights
                    </ModalHeader>
                    <ModalBody style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'hidden' }}>
                        {loadingRecommendation ? (
                            <div className="text-center py-3">
                                <Spinner size="sm" /> Loading recommendation...
                            </div>
                        ) : aiRecommendation ? (
                            <div>
                                <div className="mb-3">
                                    <h6>Recommended Supplier:</h6>
                                    <p className="fw-bold" style={{ fontSize: '13px !importants', color: '#009efb' }}>
                                        {aiRecommendation.supplierName}
                                    </p>
                                    <h6 className="mt-3">Reason:</h6>
                                    <div
                                        className="reason-text"
                                        style={{
                                            maxHeight: '135px',
                                            overflowY: 'auto',
                                            paddingRight: '8px',
                                            border: '1px solid #eee',
                                            borderRadius: '4px',
                                            padding: '8px',
                                        }}
                                    >
                                        <p className="text-muted m-0">{aiRecommendation.reason}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-3 text-muted">No recommendation available</div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="secondary"
                            onClick={() => {
                                setShowAIRecommendationModal(false);
                                setAiRecommendation(null);
                            }}
                        >
                            Close
                        </Button>
                    </ModalFooter>
                </Modal>
            </ComponentCard>
            <RfqSupplierModal
                isOpen={showSupplierDialog}
                toggle={() => setShowSupplierDialog(false)}
                existingSuppliers={suppliers}
                formData={rfqData}
                newSupplier={newSupplier}
                setNewSupplier={setNewSupplier}
                addExistingSupplier={addExistingSupplier}
                onAddNewSupplier={addNewSupplier}
            />
            <Modal isOpen={showApproversModal} toggle={() => setShowApproversModal(false)} size="md">
                <ModalHeader toggle={() => setShowApproversModal(false)}>Approval Path</ModalHeader>
                <ModalBody style={{ maxHeight: '225px', overflow: 'auto' }}>
                    {(() => {
                        const supplierWithSignoff = rfqData.suppliers?.find(
                            (s) => s.supplierStatus === 'signoff_requested' && s.signOffRequests?.length > 0,
                        );

                        const signoffUsers = supplierWithSignoff?.signOffRequests?.[0]?.signoffUsers || [];

                        return signoffUsers.length > 0 ? (
                            <div>
                                {signoffUsers.map((approver, index) => (
                                    <div
                                        key={approver.rfqSignOffUserId}
                                        className="d-flex justify-content-between align-items-center mb-3 p-3"
                                        style={{ backgroundColor: '#f8f9fa', borderRadius: '8px' }}
                                    >
                                        <div>
                                            <div className="fw-bold">
                                                {index + 1}. {approver.signoffUserId.firstName}{' '}
                                                {approver.signoffUserId.lastName}
                                            </div>
                                            <div className="text-muted small">{approver.signoffUserId.email}</div>
                                        </div>
                                        <div className="text-end">
                                            <Badge
                                                color={
                                                    approver.signoffStatus === 'approved'
                                                        ? 'success'
                                                        : approver.signoffStatus === 'requested'
                                                            ? 'warning'
                                                            : 'secondary'
                                                }
                                                pill
                                            >
                                                {approver.signoffStatus
                                                    ? approver.signoffStatus.charAt(0).toUpperCase() +
                                                    approver.signoffStatus.slice(1)
                                                    : 'Pending'}
                                            </Badge>
                                            <div className="text-muted small mt-1">
                                                {approver.signedAt
                                                    ? formatDateTime(approver.signedAt)
                                                    : formatDateTime(approver.createdDate)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted py-4">No approvers found for this RFQ.</div>
                        );
                    })()}
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={() => setShowApproversModal(false)}>
                        Close
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
};

export default RFQDetail;
