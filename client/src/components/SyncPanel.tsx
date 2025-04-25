import React, { useState } from 'react';
import { Button, Card, Alert, Spinner, ListGroup } from 'react-bootstrap';

type SyncResult = {
  added: number;
  errors: number;
  total: number;
};

type SyncResults = {
  users?: SyncResult;
  companies?: SyncResult;
  employees?: SyncResult;
  userCompanies?: SyncResult;
};

export function SyncPanel() {
  const [status, setStatus] = useState<{
    loading: boolean;
    results: SyncResults | null;
    error: string | null;
  }>({ loading: false, results: null, error: null });

  const handleSync = async () => {
    setStatus({ loading: true, results: null, error: null });
    
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatus({ loading: false, results: data.results, error: null });
    } catch (error) {
      setStatus({ 
        loading: false, 
        results: null, 
        error: error instanceof Error ? error.message : 'Error desconocido durante la sincronización' 
      });
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <h3>Sincronización con Productiva</h3>
      </Card.Header>
      <Card.Body>
        <p>
          Este proceso sincronizará todos los datos (usuarios, empresas, empleados y relaciones) desde 
          la base de datos de Productiva. Primero se limpiarán todas las tablas en CreaTurno.
        </p>
        
        <div className="alert alert-warning">
          <strong>Advertencia:</strong> Esta operación eliminará todos los datos actuales en CreaTurno 
          y los reemplazará con los datos de Productiva. Asegúrese de que la URL de conexión a Productiva 
          sea correcta en la configuración.
        </div>
        
        <Button 
          variant="primary" 
          onClick={handleSync}
          disabled={status.loading}
          className="mb-3"
        >
          {status.loading ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />{' '}
              Sincronizando...
            </>
          ) : 'Sincronizar Ahora'}
        </Button>
        
        {status.error && (
          <Alert variant="danger" className="mt-3">
            <strong>Error:</strong> {status.error}
          </Alert>
        )}
        
        {status.results && (
          <Alert variant="success" className="mt-3">
            <h4>Sincronización Completa</h4>
            <ListGroup className="mt-3">
              {Object.entries(status.results).map(([key, value]) => (
                <ListGroup.Item key={key} className="d-flex justify-content-between align-items-center">
                  <span><strong>{key}:</strong></span>
                  <span>
                    <span className="badge bg-success me-2">{value.added} registros añadidos</span>
                    <span className="badge bg-primary me-2">Total: {value.total}</span>
                    {value.errors > 0 && (
                      <span className="badge bg-danger">Errores: {value.errors}</span>
                    )}
                  </span>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
}

export default SyncPanel;