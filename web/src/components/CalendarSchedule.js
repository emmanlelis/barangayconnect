import React, { useState, useEffect } from 'react';
import { Card, Typography, Badge, List, Empty, Tag, Spin, Row, Col, Button, Space, Select, message } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, FileTextOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { adminAPI } from '../services/api';
import moment from 'moment';

const { Title, Text } = Typography;

const CalendarSchedule = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(moment());
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState(null);
  const [selectedDay, setSelectedDay] = useState(moment().date());

  useEffect(() => {
    loadScheduledEvents();
  }, [currentDate]);

  useEffect(() => {
    filterEventsByDate();
  }, [events, currentDate, selectedDay, priorityFilter]);

  const loadScheduledEvents = async () => {
    try {
      setLoading(true);
      const month = currentDate.month() + 1;
      const year = currentDate.year();
      const response = await adminAPI.getScheduledEvents({ month, year });
      
      if (response.data.success) {
        setEvents(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load scheduled events:', error);
      message.error('Failed to load scheduled events');
    } finally {
      setLoading(false);
    }
  };

  const filterEventsByDate = () => {
    const selectedDateStr = currentDate.clone().date(selectedDay).format('YYYY-MM-DD');
    let filtered = events.filter(event => 
      moment(event.date).format('YYYY-MM-DD') === selectedDateStr
    );

    if (priorityFilter) {
      filtered = filtered.filter(event => event.priority === priorityFilter);
    }

    setFilteredEvents(filtered);
  };

  const getPriorityStatus = (priority) => {
    const statusMap = {
      'Urgent': 'error',
      'High': 'warning',
      'Medium': 'processing',
      'Low': 'default'
    };
    return statusMap[priority] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colorMap = {
      'Urgent': 'red',
      'High': 'orange',
      'Medium': 'blue',
      'Low': 'default'
    };
    return colorMap[priority] || 'default';
  };

  const handlePreviousMonth = () => {
    const prevMonth = currentDate.clone().subtract(1, 'month');
    setCurrentDate(prevMonth);
    setSelectedDay(prevMonth.date());
  };

  const handleNextMonth = () => {
    const nextMonth = currentDate.clone().add(1, 'month');
    setCurrentDate(nextMonth);
    setSelectedDay(nextMonth.date());
  };

  const handleToday = () => {
    const today = moment();
    setCurrentDate(today);
    setSelectedDay(today.date());
  };

  const generateCalendarDays = () => {
    const year = currentDate.year();
    const month = currentDate.month();
    const firstDay = moment([year, month, 1]);
    const lastDay = moment([year, month]).endOf('month');
    const startDate = firstDay.clone().startOf('week');
    const endDate = lastDay.clone().endOf('week');

    const days = [];
    let current = startDate.clone();

    while (current.isSameOrBefore(endDate)) {
      days.push(current.clone());
      current.add(1, 'day');
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const getEventsForDate = (date) => {
    const dateStr = date.format('YYYY-MM-DD');
    return events.filter(event => 
      moment(event.date).format('YYYY-MM-DD') === dateStr
    );
  };

  const isCurrentMonth = (date) => {
    return date.month() === currentDate.month() && date.year() === currentDate.year();
  };

  const isSelectedDay = (date) => {
    return date.format('YYYY-MM-DD') === currentDate.clone().date(selectedDay).format('YYYY-MM-DD');
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <CalendarOutlined /> Calendar Schedule
        </Title>
        <Space>
          <Button icon={<LeftOutlined />} onClick={handlePreviousMonth} />
          <Button type="primary" onClick={handleToday}>Today</Button>
          <Button icon={<RightOutlined />} onClick={handleNextMonth} />
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {/* Calendar Column */}
        <Col xs={24} lg={16}>
          <Card loading={loading} style={{ minHeight: '600px' }}>
            <div style={{ marginBottom: '20px' }}>
              <Title level={4} style={{ margin: 0, textAlign: 'center' }}>
                {currentDate.format('MMMM YYYY')}
              </Title>
            </div>

            {/* Calendar Grid */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <th key={day} style={{ 
                        textAlign: 'center', 
                        padding: '12px', 
                        borderBottom: '2px solid #f0f0f0',
                        fontWeight: 'bold',
                        backgroundColor: '#fafafa'
                      }}>
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, weekIdx) => (
                    <tr key={weekIdx}>
                      {week.map((date, dayIdx) => {
                        const dayEvents = getEventsForDate(date);
                        const isCurrentMonthDay = isCurrentMonth(date);
                        const isSelected = isSelectedDay(date);
                        const isToday = date.format('YYYY-MM-DD') === moment().format('YYYY-MM-DD');

                        return (
                          <td
                            key={dayIdx}
                            onClick={() => {
                              if (isCurrentMonthDay) {
                                setSelectedDay(date.date());
                              }
                            }}
                            style={{
                              border: '1px solid #e8e8e8',
                              padding: '8px',
                              verticalAlign: 'top',
                              height: '120px',
                              cursor: isCurrentMonthDay ? 'pointer' : 'default',
                              backgroundColor: isSelected 
                                ? '#e6f7ff' 
                                : isToday && isCurrentMonthDay
                                ? '#f6ffed'
                                : isCurrentMonthDay 
                                ? '#fff' 
                                : '#fafafa',
                              opacity: isCurrentMonthDay ? 1 : 0.5,
                              transition: 'background-color 0.2s'
                            }}
                          >
                            <div style={{
                              fontWeight: isSelected || isToday ? 'bold' : 'normal',
                              marginBottom: '4px',
                              color: isCurrentMonthDay ? '#000' : '#999',
                              fontSize: '14px'
                            }}>
                              {date.date()}
                            </div>
                            <div>
                              {dayEvents.slice(0, 2).map((event, idx) => (
                                <div key={idx} style={{ marginBottom: '2px' }}>
                                  <Badge 
                                    status={getPriorityStatus(event.priority)} 
                                    text={
                                      <Text ellipsis style={{ fontSize: '11px' }}>
                                        {event.caseNumber}
                                      </Text>
                                    }
                                  />
                                </div>
                              ))}
                              {dayEvents.length > 2 && (
                                <Text style={{ fontSize: '10px', color: '#999' }}>
                                  +{dayEvents.length - 2} more
                                </Text>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Col>

        {/* Events List Column */}
        <Col xs={24} lg={8}>
          <Card title={`Events for ${currentDate.clone().date(selectedDay).format('MMMM DD, YYYY')}`}>
            <div style={{ marginBottom: '16px' }}>
              <Select
                placeholder="Filter by Priority"
                style={{ width: '100%' }}
                allowClear
                value={priorityFilter}
                onChange={(value) => setPriorityFilter(value)}
              >
                <Select.Option value="Urgent">Urgent</Select.Option>
                <Select.Option value="High">High</Select.Option>
                <Select.Option value="Medium">Medium</Select.Option>
                <Select.Option value="Low">Low</Select.Option>
              </Select>
            </div>

            {loading ? (
              <Spin />
            ) : filteredEvents.length > 0 ? (
              <List
                dataSource={filteredEvents}
                renderItem={(event) => (
                  <List.Item
                    style={{
                      padding: '12px',
                      border: '1px solid #f0f0f0',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      backgroundColor: '#fafafa'
                    }}
                  >
                    <List.Item.Meta
                      avatar={<FileTextOutlined />}
                      title={
                        <div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <Text strong>{event.caseNumber}</Text>
                            <Tag color={getPriorityColor(event.priority)}>
                              {event.priority || 'Medium'}
                            </Tag>
                            <Tag color="blue">{event.status}</Tag>
                          </div>
                        </div>
                      }
                      description={
                        <div>
                          <div style={{ marginBottom: '4px' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              Complainant: {event.complainant}
                            </Text>
                          </div>
                          <div style={{ marginBottom: '4px' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              Respondent: {event.respondent}
                            </Text>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px' }}>
                              <CalendarOutlined /> {moment(event.date).format('MMM DD, YYYY')}
                            </span>
                            {event.time && (
                              <span style={{ fontSize: '12px' }}>
                                <ClockCircleOutlined /> {event.time}
                              </span>
                            )}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No events scheduled for this date" />
            )}

            {/* Summary Stats */}
            {events.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
                <Title level={5}>Month Summary</Title>
                <div style={{ fontSize: '12px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Total Scheduled:</strong> {events.length}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>By Priority:</strong>
                  </div>
                  <div style={{ marginLeft: '16px' }}>
                    {['Urgent', 'High', 'Medium', 'Low'].map(priority => {
                      const count = events.filter(e => e.priority === priority).length;
                      return count > 0 ? (
                        <div key={priority} style={{ marginBottom: '4px' }}>
                          <Tag color={getPriorityColor(priority)}>{priority}</Tag> {count}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CalendarSchedule;
