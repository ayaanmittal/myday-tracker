import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Trophy, Medal, Award, TrendingUp } from 'lucide-react';

interface EmployeeRanking {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_category: string;
  totalLeavesTaken: number;
}

interface EmployeeRankingCardProps {
  rankings: EmployeeRanking[];
  onEmployeeClick?: (employeeId: string) => void;
}

const EmployeeRankingCard: React.FC<EmployeeRankingCardProps> = ({ rankings, onEmployeeClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerView = 3;

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 1:
        return <Medal className="h-4 w-4 text-gray-400" />;
      case 2:
        return <Award className="h-4 w-4 text-amber-600" />;
      default:
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
    }
  };

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 1:
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 2:
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => 
      prev + itemsPerView >= rankings.length ? 0 : prev + itemsPerView
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => 
      prev - itemsPerView < 0 ? Math.max(0, rankings.length - itemsPerView) : prev - itemsPerView
    );
  };

  const visibleRankings = rankings.slice(currentIndex, currentIndex + itemsPerView);

  if (rankings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Employee Rankings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No leave data available for ranking
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Top Leave Takers</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevSlide}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1}-{Math.min(currentIndex + itemsPerView, rankings.length)} of {rankings.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextSlide}
              disabled={currentIndex + itemsPerView >= rankings.length}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleRankings.map((employee, index) => {
            const globalIndex = currentIndex + index;
            return (
              <div
                key={employee.employee_id}
                className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                  onEmployeeClick ? 'hover:bg-gray-50' : ''
                }`}
                onClick={() => onEmployeeClick?.(employee.employee_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getRankIcon(globalIndex)}
                      <span className="font-bold text-lg">#{globalIndex + 1}</span>
                    </div>
                    <div>
                      <div className="font-medium">{employee.employee_name}</div>
                      <div className="text-sm text-muted-foreground">{employee.employee_email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">
                      {employee.totalLeavesTaken} days
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getRankColor(globalIndex)}`}
                    >
                      {employee.employee_category}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {rankings.length > itemsPerView && (
          <div className="flex justify-center mt-4">
            <div className="flex space-x-1">
              {Array.from({ length: Math.ceil(rankings.length / itemsPerView) }).map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    Math.floor(currentIndex / itemsPerView) === index
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                  }`}
                  onClick={() => setCurrentIndex(index * itemsPerView)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeRankingCard;
