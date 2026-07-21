// src/lib/campuses.ts
// Centralized campus configuration — auto-fills session security settings

export interface CampusConfig {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  defaultRadiusMeters: number;
  antiFraud: {
    gpsProximityCheck: boolean;
    deviceBinding: boolean;
    oneTimeQR: boolean;
    sessionExpiry: boolean;
    ipValidation: boolean;
    multipleDeviceDetection: boolean;
    locationVerification: boolean;
  };
}

export const CAMPUSES: CampusConfig[] = [
{
  id: 'kabarak-main',
  name: 'Kabarak Main Campus',
  latitude: -0.1671,
  longitude: 35.966,
  defaultRadiusMeters: 500,
    antiFraud: {
      gpsProximityCheck: true,
      deviceBinding: true,
      oneTimeQR: true,
      sessionExpiry: true,
      ipValidation: true,
      multipleDeviceDetection: true,
      locationVerification: true,
    },
  },
  {
    id: 'nakuru-town',
    name: 'Nakuru Town Campus',
    latitude: -0.2833,
    longitude: 36.0667,
    defaultRadiusMeters: 200,
    antiFraud: {
      gpsProximityCheck: true,
      deviceBinding: true,
      oneTimeQR: true,
      sessionExpiry: true,
      ipValidation: true,
      multipleDeviceDetection: true,
      locationVerification: true,
    },
  },
];

export function getCampusById(id: string): CampusConfig | undefined {
  return CAMPUSES.find((c) => c.id === id);
}
