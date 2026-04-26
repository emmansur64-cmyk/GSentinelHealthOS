"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { Doctor } from "@/components/agenda/types";

type DoctorFilterProps = {
  doctors: Doctor[];
  selectedDoctorId: string;
  loading: boolean;
  onChange: (doctorId: string) => void;
};

export function DoctorFilter({ doctors, selectedDoctorId, loading, onChange }: DoctorFilterProps) {
  return (
    <div className="min-w-64">
      <Select value={selectedDoctorId} onValueChange={(value) => onChange(value ?? "all")} disabled={loading}>
        <SelectTrigger>
          <SelectValue placeholder="Filtrar por medico" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los medicos</SelectItem>
          {doctors.map((doctor) => (
            <SelectItem key={doctor.user_id} value={doctor.user_id}>
              {doctor.user.name} - {doctor.specialty}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
