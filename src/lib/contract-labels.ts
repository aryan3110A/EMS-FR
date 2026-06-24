/** PDF §3.1 — Basic Contract Information field labels */

export const BASIC_DATE_LABELS = {
  contractSentDate: 'Final Contract Sent to Buyer Date',
  receivedDate: 'Signed Contract Received from Buyer Date',
  contractDate: 'Marking Details Received from Buyer Date',
  signedContractReceivedDate: 'Marking Sent to Production Date',
} as const;

export const CONTAINER_FIELD_LABELS = {
  containerSequence: 'Container',
  shippingContainerNo: 'Shipping Container No.',
  allocatedMt: 'Allocated Quantity / MT',
  totalFreight: 'Total Freight for Container',
  freightPerMt: 'Freight per MT',
  expectedShipmentDate: 'Expected Shipment Date',
  shipmentMonth: 'Shipment Month',
  shipmentPeriod: 'Shipment Period',
} as const;

export const INCOTERM_OPTIONS = [
  { value: 'FOB', label: 'FOB' },
  { value: 'CIF', label: 'CIF' },
  { value: 'CNF', label: 'CNF' },
] as const;
